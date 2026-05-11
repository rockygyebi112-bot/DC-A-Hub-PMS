"use server";

import { headers } from "next/headers";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireProjectReader } from "@/lib/auth/guards";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type UnlockedDocument = {
  id: string;
  fileName: string;
  caption: string | null;
  mimeType: string | null;
  kind: "file" | "link";
  url: string;
  phaseName: string | null;
  activityId: string;
  activityName: string | null;
  createdAt: string;
};

/**
 * Verify the caller's sign-in password, then return every uploaded proof
 * (files + links) for the given project with short-lived URLs ready to open.
 * This is the single password gate for the portal "Uploads" tab — clients
 * unlock once per session rather than per-document.
 *
 * Every document returned is written to `proof_access_log` as a single bulk
 * audit row (purpose = "bulk_unlock") so admins can still see who opened the
 * uploads page and which files were exposed.
 */
export async function unlockProjectDocuments(
  projectId: string,
  password: string,
): Promise<ActionResult<UnlockedDocument[]>> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  if (typeof password !== "string" || password.length === 0) {
    return { ok: false, error: "Password is required" };
  }

  const authz = await requireProjectReader(projectId);
  if (!authz.ok) {
    return { ok: false, error: "Not authorized to view these documents" };
  }

  const sb = await createClient();

  // Re-verify identity using a fresh supabase-js client so the real session
  // cookies are never touched. Same pattern as `requestProofAccess`.
  const {
    data: { user: currentUser },
  } = await sb.auth.getUser();
  if (!currentUser?.email) {
    return { ok: false, error: "Could not verify identity" };
  }
  const verifier = createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: currentUser.email,
    password,
  });
  if (verifyError) {
    return { ok: false, error: "Incorrect password" };
  }

  // Walk phases -> activities -> proofs constrained to this project.
  const { data: phases } = await sb
    .from("phases")
    .select("id, name")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });
  const phaseIds = (phases ?? []).map((p) => p.id);
  if (phaseIds.length === 0) return { ok: true, data: [] };

  const { data: activities } = await sb
    .from("activities")
    .select("id, name, phase_id")
    .in("phase_id", phaseIds);
  const activityIds = (activities ?? []).map((a) => a.id);
  if (activityIds.length === 0) return { ok: true, data: [] };

  const { data: proofs } = await sb
    .from("activity_proofs")
    .select("id, activity_id, kind, file_path, file_name, mime_type, url, caption, created_at")
    .in("activity_id", activityIds)
    .order("created_at", { ascending: false });
  if (!proofs?.length) return { ok: true, data: [] };

  const phaseNameById = new Map((phases ?? []).map((p) => [p.id, p.name]));
  const activityById = new Map(
    (activities ?? []).map((a) => [
      a.id,
      { name: a.name, phaseName: phaseNameById.get(a.phase_id) ?? null },
    ]),
  );

  // Mint URLs in parallel: files get a 5-minute signed URL on the `proofs`
  // bucket; links are passed through unchanged.
  const resolved = await Promise.all(
    proofs.map(async (p): Promise<UnlockedDocument | null> => {
      const kind = (p.kind === "link" ? "link" : "file") as "file" | "link";
      let url: string | null = null;
      if (kind === "link") {
        url = p.url ?? null;
      } else if (p.file_path) {
        const { data: signed } = await sb.storage
          .from("proofs")
          .createSignedUrl(p.file_path, 5 * 60);
        url = signed?.signedUrl ?? null;
      }
      if (!url) return null;
      const meta = activityById.get(p.activity_id);
      return {
        id: p.id,
        fileName: p.file_name,
        caption: p.caption ?? null,
        mimeType: p.mime_type,
        kind,
        url,
        phaseName: meta?.phaseName ?? null,
        activityId: p.activity_id,
        activityName: meta?.name ?? null,
        createdAt: p.created_at,
      };
    }),
  );
  const documents = resolved.filter((d): d is UnlockedDocument => d !== null);

  // Best-effort bulk audit log. One row per document so admins still see
  // which files were exposed by this unlock. Failure to log MUST NOT block
  // the user from receiving the URLs (matches `requestProofAccess`).
  try {
    const hdrs = await headers();
    const userAgent = hdrs.get("user-agent");
    const fwd = hdrs.get("x-forwarded-for");
    const ip = fwd ? fwd.split(",")[0]?.trim() || null : null;
    if (documents.length > 0) {
      await sb.from("proof_access_log").insert(
        documents.map((doc) => ({
          proof_id: doc.id,
          project_id: projectId,
          user_id: auth.userId,
          purpose: "bulk_unlock",
          user_agent: userAgent,
          ip_address: ip,
        })),
      );
    }
  } catch (err) {
    console.error("proof_access_log bulk insert failed", err);
  }

  return { ok: true, data: documents };
}
