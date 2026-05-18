"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireProjectReader } from "@/lib/auth/guards";
import { validateUpload, sanitizeFileName } from "@/lib/uploads";
import { dbErrorMessage } from "@/lib/db-errors";
import {
  checkRateLimit,
  extractClientIp,
  logPasswordVerifyAttempt,
  rateLimitMessage,
} from "@/lib/rate-limit";

import type { ActionResult } from "@/lib/action-result";
import { ACTIVITY_PROJECT_JOIN } from "@/lib/supabase/columns";

const PORTAL_NOTE_MAX = 5000;

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

  // C-4: rate limit before any DB work. 5 / 10 min per user.
  const rl = await checkRateLimit(
    "pwd-verify",
    `unlock:${auth.userId}`,
    5,
    600,
  );
  if (!rl.ok) {
    return {
      ok: false,
      error: rateLimitMessage(rl.retryAfterSeconds, "Too many password attempts"),
    };
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
  await logPasswordVerifyAttempt({
    userId: auth.userId,
    email: currentUser.email,
    success: !verifyError,
    context: "portal_unlock",
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

  // Audit FIRST, mint URLs second (H-11 fail-closed). One row per proof so
  // admins still see which files were exposed. If the audit insert fails the
  // user gets nothing — we cannot guarantee accountability otherwise.
  try {
    const hdrs = await headers();
    const userAgent = hdrs.get("user-agent");
    const ip = extractClientIp(hdrs);
    const { error: logErr } = await sb.from("proof_access_log").insert(
      proofs.map((p) => ({
        proof_id: p.id,
        project_id: projectId,
        user_id: auth.userId,
        purpose: "bulk_unlock",
        user_agent: userAgent,
        ip_address: ip,
      })),
    );
    if (logErr) {
      console.error("proof_access_log bulk insert failed", logErr);
      return { ok: false, error: "Could not record document access. Try again." };
    }
  } catch (err) {
    console.error("proof_access_log bulk insert threw", err);
    return { ok: false, error: "Could not record document access. Try again." };
  }

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

  return { ok: true, data: documents };
}

/* ──────────────────────────────────────────────────────────────────────
 *  Activity-page portal actions
 *
 *  Clients (project_viewer) need to be able to post chat-style updates and
 *  attach documents from the portal — same flow staff use in the workspace.
 *  Migration 0025 added viewer-scoped INSERT policies on activity_proofs,
 *  activity_log and the proofs storage bucket so we use the user-scoped
 *  client — no service-role bypass. RLS enforces actor_user_id = auth.uid()
 *  and uploaded_by = auth.uid().
 * ──────────────────────────────────────────────────────────────────── */
async function resolveActivityProject(
  activityId: string,
): Promise<{ projectId: string } | null> {
  // Identity check before any DB read. Callers immediately follow up with
  // `requireProjectReader`, but we should never let an unauthenticated user
  // probe activity IDs against the DB at all.
  const auth = await requireAuth();
  if (!auth.ok) return null;

  const sb = await createClient();
  const { data } = await sb
    .from("activities")
    .select(ACTIVITY_PROJECT_JOIN)
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
  const rawNote = String(formData.get("note") ?? "").trim();
  if (!rawNote) return { ok: false, error: "Write something first." };
  if (rawNote.length > PORTAL_NOTE_MAX) {
    return { ok: false, error: `Keep updates under ${PORTAL_NOTE_MAX.toLocaleString()} characters.` };
  }

  const ctx = await resolveActivityProject(activityId);
  if (!ctx) return { ok: false, error: "Activity not found" };

  const auth = await requireProjectReader(ctx.projectId);
  if (!auth.ok) return { ok: false, error: auth.error };

  // RLS (migration 0025) now permits viewer-attributed inserts for the
  // 'updated'/'proof_added' actions, so we use the user-scoped client rather
  // than the service-role client.
  const sb = await createClient();
  const { error } = await sb.from("activity_log").insert({
    project_id: ctx.projectId,
    activity_id: activityId,
    actor_user_id: auth.userId,
    action: "updated",
    meta: { note: rawNote },
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };

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

  // RLS (migration 0025) allows viewers to insert their own activity_proofs
  // rows and write into the proofs bucket for projects they can access.
  const sb = await createClient();
  for (const file of files) {
    const safeName = sanitizeFileName(file.name);
    const path = `projects/${ctx.projectId}/activities/${activityId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await sb.storage
      .from("proofs")
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
    if (uploadError) {
      console.error("[portal] proof upload failed", uploadError);
      return { ok: false, error: "Could not upload file. Try again." };
    }

    const { error: insertError } = await sb.from("activity_proofs").insert({
      activity_id: activityId,
      kind: "file",
      file_path: path,
      file_name: safeName,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: auth.userId,
    });
    if (insertError) return { ok: false, error: dbErrorMessage(insertError) };
  }

  await sb.from("activity_log").insert({
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
