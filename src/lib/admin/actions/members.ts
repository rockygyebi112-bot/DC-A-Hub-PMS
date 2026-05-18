"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import {
  addProjectMemberAsManager,
  transferProjectManager,
} from "@/lib/supabase/rpcs";
import {
  addTeamMembersSchema,
  assignMembersSchema,
  inviteClientViewerSchema,
  inviteStaffMemberSchema,
  setProjectManagerSchema,
} from "@/lib/admin/schemas";
import { inviteUser } from "./users";
import type { ActionResult } from "@/lib/action-result";

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

/**
 * Combined "Add staff" / "Add client" handler used by the simplified team
 * page. Accepts:
 *
 *   - existing_user_ids: any number of existing profiles to attach
 *   - invite_email + invite_full_name: at most one new user to invite
 *   - make_manager (staff only): promote a single new addition to PM
 *
 * For staff, attached users get project_role='member' (or 'manager' when
 * exactly one user is being added with make_manager=true). For clients,
 * users get project_role='viewer'. New invites are created with the
 * matching global role ('staff' or 'client').
 *
 * Replaces the four separate buttons (Add existing staff, Add existing
 * viewer, Invite staff, Invite client viewer) with one server entry per
 * audience.
 */
export async function addTeamMembers(
  projectId: string,
  raw: unknown,
): Promise<
  ActionResult<{
    added: number;
    skipped: number;
    invited: 0 | 1;
    delivery?: "invite_sent" | "password_setup_sent";
    promotedManager: boolean;
  }>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsed = addTeamMembersSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { kind, existing_user_ids, invite_email, invite_full_name, make_manager } =
    parsed.data;

  const hasInvite = !!invite_email;
  if (existing_user_ids.length === 0 && !hasInvite) {
    return { ok: false, error: "Pick a user or enter an invite email" };
  }

  const baseRole: "member" | "viewer" = kind === "staff" ? "member" : "viewer";
  const sb = createAdminClient();

  // 1) Optionally invite a new user.
  let invitedUserId: string | null = null;
  let delivery: "invite_sent" | "password_setup_sent" | undefined;
  if (hasInvite) {
    const inviteResult = await inviteUser({
      email: invite_email!,
      full_name: invite_full_name,
      role: kind === "staff" ? "staff" : "client",
    });
    if (!inviteResult.ok) return inviteResult;
    invitedUserId = inviteResult.data!.user_id;
    delivery = inviteResult.data!.delivery;
  }

  // 2) Combine existing + invited into one set of user ids to upsert.
  const allUserIds = Array.from(
    new Set([...existing_user_ids, ...(invitedUserId ? [invitedUserId] : [])]),
  );

  // Skip users who already have a row to avoid wiping out an existing
  // role (e.g. a current manager re-added via "Add staff" should not be
  // demoted to member).
  const { data: existingRows } = await sb
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .in("user_id", allUserIds);
  const taken = new Set((existingRows ?? []).map((r) => r.user_id));
  const toInsert = allUserIds.filter((id) => !taken.has(id));

  // 3) Decide whether this batch promotes someone to manager. We only
  //    honour make_manager when staff are being added AND exactly one
  //    *new* member is in the batch — this keeps the at-most-one-PM
  //    invariant from accidentally being violated by bulk adds.
  //
  // The PM-promotion path uses an atomic RPC (`add_project_member_as_manager`,
  // migration 0029) so the demote-current-PM + insert-new-PM pair runs in a
  // single transaction. The previous two-step app-side flow could leave a
  // project with zero managers if the process crashed between calls.
  let promotedManager = false;
  if (
    kind === "staff" &&
    make_manager &&
    toInsert.length === 1
  ) {
    const promoteRes = await addProjectMemberAsManager(sb, {
      project_id: projectId,
      user_id: toInsert[0],
    });
    if (promoteRes.error) {
      console.error("[members] add_project_member_as_manager failed", promoteRes.error);
      return { ok: false, error: GENERIC_DB_ERROR };
    }
    promotedManager = true;
  } else if (toInsert.length > 0) {
    const { error: insertErr } = await sb.from("project_members").insert(
      toInsert.map((user_id) => ({
        project_id: projectId,
        user_id,
        project_role: baseRole,
      })),
    );
    if (insertErr) return { ok: false, error: GENERIC_DB_ERROR };
  }

  revalidatePath(`/admin/projects/${projectId}/team`);
  return {
    ok: true,
    data: {
      added: toInsert.length,
      skipped: taken.size,
      invited: hasInvite ? 1 : 0,
      delivery,
      promotedManager,
    },
  };
}

/**
 * Promote a member to project manager. Demotes the previous PM (if any)
 * back to member. The DB enforces at most one manager per project via a
 * partial unique index, so demoting first keeps the update atomic from
 * the index's point of view.
 *
 * Only staff/admin members can be made PM; clients (project_role='viewer')
 * are rejected here.
 */
export async function setProjectManager(
  projectId: string,
  raw: unknown,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsed = setProjectManagerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = createAdminClient();

  // Atomic demote-old-PM + promote-new-PM via the RPC in migration 0029.
  // The previous flow ran two separate UPDATEs from the app server; a crash
  // between them could leave the project with zero managers.
  const res = await transferProjectManager(sb, {
    project_id: projectId,
    member_id: parsed.data.member_id,
  });
  if (res.error) {
    if (res.error.message?.includes("invalid_target_member")) {
      return { ok: false, error: "Member not found" };
    }
    if (res.error.message?.includes("viewer_cannot_be_manager")) {
      return { ok: false, error: "Clients cannot be made project manager" };
    }
    console.error("[members] transfer_project_manager failed", res.error);
    return { ok: false, error: GENERIC_DB_ERROR };
  }

  revalidatePath(`/admin/projects/${projectId}/team`);
  return { ok: true };
}

/** Demote the current project manager back to a regular member. */
export async function unsetProjectManager(
  projectId: string,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const sb = createAdminClient();
  const { error } = await sb
    .from("project_members")
    .update({ project_role: "member" })
    .eq("project_id", projectId)
    .eq("project_role", "manager");
  if (error) return { ok: false, error: GENERIC_DB_ERROR };

  revalidatePath(`/admin/projects/${projectId}/team`);
  return { ok: true };
}
