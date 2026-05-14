"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import {
  assignMembersSchema,
  inviteClientViewerSchema,
  inviteStaffMemberSchema,
} from "@/lib/admin/schemas";
import { inviteUser } from "./users";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const GENERIC_DB_ERROR = "Operation failed";

export async function addProjectMembers(
  projectId: string,
  raw: unknown,
): Promise<ActionResult<{ added: number; skipped: number }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsed = assignMembersSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = createAdminClient();

  // Skip users who are already members of the project so the insert doesn't
  // fail the entire batch on a unique-constraint violation.
  const { data: existing } = await sb
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .in("user_id", parsed.data.user_ids);
  const taken = new Set((existing ?? []).map((row) => row.user_id));
  const toInsert = parsed.data.user_ids.filter((id) => !taken.has(id));

  if (toInsert.length === 0) {
    return { ok: true, data: { added: 0, skipped: taken.size } };
  }

  const { error } = await sb.from("project_members").insert(
    toInsert.map((user_id) => ({
      project_id: projectId,
      user_id,
      project_role: parsed.data.project_role,
    })),
  );
  if (error) return { ok: false, error: GENERIC_DB_ERROR };

  revalidatePath(`/admin/projects/${projectId}/team`);
  return { ok: true, data: { added: toInsert.length, skipped: taken.size } };
}

export async function removeProjectMember(
  projectId: string,
  memberRowId: string,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const sb = createAdminClient();
  const { error } = await sb
    .from("project_members")
    .delete()
    .eq("id", memberRowId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: GENERIC_DB_ERROR };
  revalidatePath(`/admin/projects/${projectId}/team`);
  return { ok: true };
}

export async function inviteClientViewer(
  projectId: string,
  raw: unknown,
): Promise<ActionResult<{ delivery: "invite_sent" | "password_setup_sent" }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsed = inviteClientViewerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const inviteResult = await inviteUser({
    email: parsed.data.email,
    full_name: parsed.data.full_name,
    role: "client",
  });
  if (!inviteResult.ok) return inviteResult;

  const sb = createAdminClient();
  const { error } = await sb.from("project_members").upsert(
    {
      project_id: projectId,
      user_id: inviteResult.data!.user_id,
      project_role: "viewer",
    },
    { onConflict: "project_id,user_id" },
  );
  if (error) {
    return { ok: false, error: GENERIC_DB_ERROR };
  }

  revalidatePath(`/admin/projects/${projectId}/team`);
  return { ok: true, data: { delivery: inviteResult.data!.delivery } };
}

/**
 * One-step "invite a staff member directly into this project". Creates the
 * profile with the global `staff` role AND assigns them as a project
 * `member` (the write-capable project role) in a single round-trip.
 *
 * Without this, an admin had to invite the user via `/admin/users` first
 * and then come back to the team page to add them — a two-step flow that
 * commonly resulted in staff being mistakenly assigned only as `viewer`
 * (read-only), making them indistinguishable from client viewers.
 */
export async function inviteStaffMember(
  projectId: string,
  raw: unknown,
): Promise<ActionResult<{ delivery: "invite_sent" | "password_setup_sent" }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsed = inviteStaffMemberSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const inviteResult = await inviteUser({
    email: parsed.data.email,
    full_name: parsed.data.full_name,
    role: "staff",
  });
  if (!inviteResult.ok) return inviteResult;

  const sb = createAdminClient();
  const { error } = await sb.from("project_members").upsert(
    {
      project_id: projectId,
      user_id: inviteResult.data!.user_id,
      project_role: "member",
    },
    { onConflict: "project_id,user_id" },
  );
  if (error) {
    return { ok: false, error: GENERIC_DB_ERROR };
  }

  revalidatePath(`/admin/projects/${projectId}/team`);
  return { ok: true, data: { delivery: inviteResult.data!.delivery } };
}
