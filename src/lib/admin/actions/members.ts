"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import {
  assignMemberSchema,
  inviteClientViewerSchema,
} from "@/lib/admin/schemas";
import { inviteUser } from "./users";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const GENERIC_DB_ERROR = "Operation failed";

export async function addProjectMember(
  projectId: string,
  raw: unknown,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsed = assignMemberSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = createAdminClient();
  const { error } = await sb.from("project_members").insert({
    project_id: projectId,
    user_id: parsed.data.user_id,
    project_role: parsed.data.project_role,
  });
  if (error) return { ok: false, error: GENERIC_DB_ERROR };
  revalidatePath(`/admin/projects/${projectId}/team`);
  return { ok: true };
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
): Promise<ActionResult> {
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
  return { ok: true };
}
