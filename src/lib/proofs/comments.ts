"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireProjectReader } from "@/lib/auth/guards";

export type ProofComment = {
  id: string;
  proof_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  author_avatar_url: string | null;
};

export type MentionableUser = {
  user_id: string;
  full_name: string;
  email: string;
  role: "admin" | "staff" | "client";
  avatar_url: string | null;
  is_manager: boolean;
};

const bodySchema = z
  .string()
  .trim()
  .min(1, "Comment cannot be empty")
  .max(4000, "Comment is too long (max 4000 characters)");

/**
 * Resolve the project + activity a proof belongs to. We hop proof →
 * activity → phase → project so we can run the project access guard
 * before any read/write, and so the activity_log entry we record for
 * comment notifications has the right project_id / activity_id.
 */
async function proofContext(
  proofId: string,
): Promise<{ projectId: string; activityId: string; fileName: string } | null> {
  const sb = await createClient();
  const { data } = await sb
    .from("activity_proofs")
    .select(
      "file_name, activity:activities!inner(id, phase:phases!inner(project_id))",
    )
    .eq("id", proofId)
    .maybeSingle();
  // Supabase nested selects return objects, not arrays, when using !inner.
  type Row = {
    file_name: string;
    activity: {
      id: string;
      phase: { project_id: string };
    } | null;
  };
  const row = data as Row | null;
  if (!row?.activity?.id || !row.activity.phase?.project_id) return null;
  return {
    projectId: row.activity.phase.project_id,
    activityId: row.activity.id,
    fileName: row.file_name,
  };
}

/**
 * List every comment on a proof, oldest first. Caller must have at least
 * read access to the project; we re-check on the server even though RLS
 * would also block, so we can return a clean typed error to the UI.
 */
export async function listProofComments(
  proofId: string,
): Promise<{ ok: true; data: ProofComment[] } | { ok: false; error: string }> {
  const ctx = await proofContext(proofId);
  if (!ctx) return { ok: false, error: "Proof not found" };

  const guard = await requireProjectReader(ctx.projectId);
  if (!guard.ok) return { ok: false, error: guard.error };

  const sb = await createClient();
  const { data, error } = await sb
    .from("proof_comments")
    .select("id, proof_id, author_user_id, body, created_at, updated_at")
    .eq("proof_id", proofId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const rows = data ?? [];
  if (rows.length === 0) return { ok: true, data: [] };

  const authorIds = Array.from(new Set(rows.map((r) => r.author_user_id)));
  const { data: profiles } = await sb
    .from("profiles")
    .select("user_id, full_name, avatar_url")
    .in("user_id", authorIds);
  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.user_id,
      { full_name: p.full_name as string | null, avatar_url: p.avatar_url as string | null },
    ]),
  );

  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id as string,
      proof_id: r.proof_id as string,
      author_user_id: r.author_user_id as string,
      body: r.body as string,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      author_name: profileMap.get(r.author_user_id)?.full_name ?? null,
      author_avatar_url: profileMap.get(r.author_user_id)?.avatar_url ?? null,
    })),
  };
}

/**
 * List the people the current user can @mention in a comment on a given
 * proof. That's every project_member plus all admins (admins aren't
 * always added to project_members but should always be reachable). The
 * "manager" flag highlights the most senior staff member so the picker
 * can label them as Project Manager.
 */
export async function listMentionableUsers(
  proofId: string,
): Promise<{ ok: true; data: MentionableUser[] } | { ok: false; error: string }> {
  const ctx = await proofContext(proofId);
  if (!ctx) return { ok: false, error: "Proof not found" };

  const guard = await requireProjectReader(ctx.projectId);
  if (!guard.ok) return { ok: false, error: guard.error };

  const sb = await createClient();
  const [{ data: memberRows }, { data: adminRows }] = await Promise.all([
    sb
      .from("project_members")
      .select("user_id")
      .eq("project_id", ctx.projectId),
    sb.from("profiles").select("user_id").eq("role", "admin"),
  ]);

  const userIds = new Set<string>();
  for (const m of memberRows ?? []) userIds.add(m.user_id as string);
  for (const a of adminRows ?? []) userIds.add(a.user_id as string);
  // Don't suggest the author themselves — you can't @ yourself usefully.
  userIds.delete(guard.userId);
  if (userIds.size === 0) return { ok: true, data: [] };

  const { data: profiles } = await sb
    .from("profiles")
    .select("user_id, full_name, email, role, avatar_url")
    .in("user_id", Array.from(userIds));

  const ROLE_RANK: Record<string, number> = { admin: 0, staff: 1, client: 2 };
  const sorted = (profiles ?? []).slice().sort((a, b) => {
    const ra = ROLE_RANK[a.role as string] ?? 3;
    const rb = ROLE_RANK[b.role as string] ?? 3;
    if (ra !== rb) return ra - rb;
    return (a.full_name ?? "").localeCompare(b.full_name ?? "");
  });

  return {
    ok: true,
    data: sorted.map((p, idx) => ({
      user_id: p.user_id as string,
      full_name: (p.full_name as string) ?? "",
      email: (p.email as string) ?? "",
      role: p.role as MentionableUser["role"],
      avatar_url: (p.avatar_url as string | null) ?? null,
      // Highlight the top-ranked admin/staff entry as the "manager" so the
      // UI can label them Project Manager — matches getProjectManager.
      is_manager: idx === 0 && (p.role === "admin" || p.role === "staff"),
    })),
  };
}

/**
 * Add a comment to a proof. Allowed for anyone with project access
 * (members, admins, and client viewers all qualify). Optionally tags
 * specific users via @mentions; each tagged user gets a per-user
 * 'proof_mentioned' notification in addition to the broadcast
 * 'proof_commented' one.
 */
export async function addProofComment(
  proofId: string,
  rawBody: string,
  mentionedUserIds: string[] = [],
): Promise<{ ok: true; data: ProofComment } | { ok: false; error: string }> {
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid comment" };
  }
  const body = parsed.data;

  const ctx = await proofContext(proofId);
  if (!ctx) return { ok: false, error: "Proof not found" };

  const guard = await requireProjectReader(ctx.projectId);
  if (!guard.ok) return { ok: false, error: guard.error };

  const sb = await createClient();
  const { data, error } = await sb
    .from("proof_comments")
    .insert({ proof_id: proofId, author_user_id: guard.userId, body })
    .select("id, proof_id, author_user_id, body, created_at, updated_at")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save comment" };
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("user_id", guard.userId)
    .maybeSingle();

  // De-dup, drop self-mentions, and sanity-check the IDs are valid uuids
  // before writing per-user mention notifications. We use the same
  // 'proof_mentioned' action for each so the bell can target a single
  // user via target_user_id.
  const validMentions = Array.from(new Set(mentionedUserIds))
    .filter((id) => typeof id === "string" && id.length === 36)
    .filter((id) => id !== guard.userId);

  // Record the comment as a project event so admins/staff get a
  // notification via the existing notifications bell (which reads from
  // activity_log). meta.preview is a short snippet so the bell can show
  // "Jane commented on report.pdf: 'Looks good…'" without an extra fetch.
  // meta.mentioned_user_ids lets the feed skip the broadcast row for
  // users who already receive a targeted 'proof_mentioned' entry, so
  // they don't see two bell items for one comment.
  const preview = body.length > 140 ? `${body.slice(0, 140).trimEnd()}\u2026` : body;
  await sb.from("activity_log").insert({
    project_id: ctx.projectId,
    activity_id: ctx.activityId,
    actor_user_id: guard.userId,
    action: "proof_commented",
    meta: {
      proof_id: proofId,
      proof_name: ctx.fileName,
      comment_id: data.id,
      preview,
      mentioned_user_ids: validMentions,
    },
  });

  if (validMentions.length > 0) {
    await sb.from("activity_log").insert(
      validMentions.map((targetUserId) => ({
        project_id: ctx.projectId,
        activity_id: ctx.activityId,
        actor_user_id: guard.userId,
        target_user_id: targetUserId,
        action: "proof_mentioned",
        meta: {
          proof_id: proofId,
          proof_name: ctx.fileName,
          comment_id: data.id,
          preview,
        },
      })),
    );
  }

  // The proof lives under both surfaces; revalidate both to refresh the
  // comment list wherever it's rendered.
  revalidatePath(`/portal/projects/${ctx.projectId}`);
  revalidatePath(`/workspace/projects/${ctx.projectId}`);

  return {
    ok: true,
    data: {
      id: data.id as string,
      proof_id: data.proof_id as string,
      author_user_id: data.author_user_id as string,
      body: data.body as string,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      author_name: (profile?.full_name as string | null) ?? null,
      author_avatar_url: (profile?.avatar_url as string | null) ?? null,
    },
  };
}

/**
 * Edit an existing comment. Only the author may edit — RLS enforces
 * this, but we gate at the action layer for a friendlier error. Body is
 * validated the same way as on insert.
 */
export async function updateProofComment(
  commentId: string,
  rawBody: string,
): Promise<{ ok: true; data: ProofComment } | { ok: false; error: string }> {
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid comment" };
  }
  const body = parsed.data;

  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  const sb = await createClient();
  const { data: existing } = await sb
    .from("proof_comments")
    .select("author_user_id, proof_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Comment not found" };
  if (existing.author_user_id !== auth.userId) {
    return { ok: false, error: "Only the author can edit this comment" };
  }

  const { data, error } = await sb
    .from("proof_comments")
    .update({ body })
    .eq("id", commentId)
    .select("id, proof_id, author_user_id, body, created_at, updated_at")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save edit" };
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("user_id", auth.userId)
    .maybeSingle();

  const ctx = await proofContext(existing.proof_id as string);
  if (ctx) {
    revalidatePath(`/portal/projects/${ctx.projectId}`);
    revalidatePath(`/workspace/projects/${ctx.projectId}`);
  }

  return {
    ok: true,
    data: {
      id: data.id as string,
      proof_id: data.proof_id as string,
      author_user_id: data.author_user_id as string,
      body: data.body as string,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      author_name: (profile?.full_name as string | null) ?? null,
      author_avatar_url: (profile?.avatar_url as string | null) ?? null,
    },
  };
}

/**
 * Delete a comment. RLS limits this to the author or an admin; we also
 * gate at the action layer for a friendlier error.
 */
export async function deleteProofComment(
  commentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  const sb = await createClient();
  const { data: existing } = await sb
    .from("proof_comments")
    .select("author_user_id, proof_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Comment not found" };

  if (auth.role !== "admin" && existing.author_user_id !== auth.userId) {
    return { ok: false, error: "Not authorized" };
  }

  const { error } = await sb.from("proof_comments").delete().eq("id", commentId);
  if (error) return { ok: false, error: error.message };

  const ctx = await proofContext(existing.proof_id as string);
  if (ctx) {
    revalidatePath(`/portal/projects/${ctx.projectId}`);
    revalidatePath(`/workspace/projects/${ctx.projectId}`);
  }
  return { ok: true };
}
