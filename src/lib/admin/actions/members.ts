"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  assignMemberSchema,
  inviteClientViewerSchema,
} from "@/lib/admin/schemas";
import { inviteUser } from "./users";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function addProjectMember(
  projectId: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = assignMemberSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
  const { error } = await sb.from("project_members").insert({
    project_id: projectId,
    user_id: parsed.data.user_id,
    project_role: parsed.data.project_role,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/projects/${projectId}/team`);
  return { ok: true };
}

export async function removeProjectMember(
  projectId: string,
  memberRowId: string,
): Promise<ActionResult> {
  const sb = await createClient();
  const { error } = await sb
    .from("project_members")
    .delete()
    .eq("id", memberRowId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/projects/${projectId}/team`);
  return { ok: true };
}

export async function inviteClientViewer(
  projectId: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = inviteClientViewerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const inviteResult = await inviteUser({
    email: parsed.data.email,
    full_name: parsed.data.full_name,
    role: "client",
  });
  if (!inviteResult.ok) return inviteResult;

  const sb = await createClient();
  const { error } = await sb.from("project_members").upsert(
    {
      project_id: projectId,
      user_id: inviteResult.data!.user_id,
      project_role: "viewer",
    },
    { onConflict: "project_id,user_id" },
  );
  if (error) {
    return {
      ok: false,
      error: `Invited but membership failed: ${error.message}`,
    };
  }

  revalidatePath(`/admin/projects/${projectId}/team`);
  return { ok: true };
}
