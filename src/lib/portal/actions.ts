"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireProjectReader } from "@/lib/auth/guards";
import { validateUpload, sanitizeFileName } from "@/lib/uploads";

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

/* ──────────────────────────────────────────────────────────────────────
 *  Activity-page portal actions
 *
 *  Clients (project_viewer) need to be able to post chat-style updates and
 *  attach documents from the portal — same flow staff use in the workspace.
 *  Current RLS only lets project members write, so we bypass RLS via the
 *  admin client *after* manually checking `requireProjectReader`. The
 *  service-role write is logged as the caller (`actor_user_id`) and audited
 *  through `activity_log`, so admins still see exactly who posted what.
 * ──────────────────────────────────────────────────────────────────── */
async function resolveActivityProject(
  activityId: string,
): Promise<{ projectId: string } | null> {
  const sb = await createClient();
  const { data } = await sb
    .from("activities")
    .select("phase:phases(project_id)")
    .eq("id", activityId)
    .maybeSingle();
  const phase = Array.isArray(data?.phase) ? data?.phase[0] : data?.phase;
  if (!phase?.project_id) return null;
  return { projectId: phase.project_id as string };
}

export async function portalPostActivityUpdate(
  activityId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { ok: false, error: "Write something first." };

  const ctx = await resolveActivityProject(activityId);
  if (!ctx) return { ok: false, error: "Activity not found" };

  const auth = await requireProjectReader(ctx.projectId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const admin = createAdminClient();
  const { error } = await admin.from("activity_log").insert({
    project_id: ctx.projectId,
    activity_id: activityId,
    actor_user_id: auth.userId,
    action: "updated",
    meta: { note },
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/portal/projects/${ctx.projectId}/activities/${activityId}`);
  revalidatePath(`/workspace/projects/${ctx.projectId}/activities/${activityId}`);
  return { ok: true };
}

export async function portalUploadActivityDocuments(
  activityId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const files = formData
    .getAll("proofs")
    .filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) return { ok: false, error: "Choose at least one file" };

  const ctx = await resolveActivityProject(activityId);
  if (!ctx) return { ok: false, error: "Activity not found" };

  const auth = await requireProjectReader(ctx.projectId);
  if (!auth.ok) return { ok: false, error: auth.error };

  // Validate every file up-front so partial batches never land in storage.
  for (const file of files) {
    const validation = validateUpload("proof", {
      size: file.size,
      mimeType: file.type,
      fileName: file.name,
    });
    if (!validation.ok) return { ok: false, error: validation.error };
  }

  const admin = createAdminClient();
  for (const file of files) {
    const safeName = sanitizeFileName(file.name);
    const path = `projects/${ctx.projectId}/activities/${activityId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await admin.storage
      .from("proofs")
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
    if (uploadError) return { ok: false, error: uploadError.message };

    const { error: insertError } = await admin.from("activity_proofs").insert({
      activity_id: activityId,
      kind: "file",
      file_path: path,
      file_name: safeName,
      mime_type: file.type || null,
      size_bytes: file.size,
    });
    if (insertError) return { ok: false, error: insertError.message };
  }

  await admin.from("activity_log").insert({
    project_id: ctx.projectId,
    activity_id: activityId,
    actor_user_id: auth.userId,
    action: "proof_added",
    meta: { count: files.length },
  });

  revalidatePath(`/portal/projects/${ctx.projectId}/activities/${activityId}`);
  revalidatePath(`/workspace/projects/${ctx.projectId}/activities/${activityId}`);
  return { ok: true };
}
