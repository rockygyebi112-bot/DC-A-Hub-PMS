"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { projectFormSchema } from "@/lib/admin/schemas";
import { dbErrorMessage } from "@/lib/db-errors";
import { ADMIN_CACHE_TAGS } from "@/lib/admin/queries";
import type { ActionResult } from "@/lib/action-result";

const GENERIC_DB_ERROR = "Operation failed";

export async function createProject(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const parsed = projectFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("projects")
    .insert({
      name: parsed.data.name,
      code: parsed.data.code,
      client_id: parsed.data.client_id,
      status: parsed.data.status,
      description: parsed.data.description ?? null,
      start_date: parsed.data.start_date ?? null,
      end_date: parsed.data.end_date ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: GENERIC_DB_ERROR };
  revalidatePath("/admin/projects");
  // Both shells (admin + workspace) render their sidebars from cached
  // layout payloads; bust them so the new project appears immediately.
  // `admin-projects` is the cross-request snapshot the admin shell reads.
  revalidateTag("admin-layout", "max");
  revalidateTag("workspace-layout", "max");
  revalidateTag(ADMIN_CACHE_TAGS.projects, "max");
  return { ok: true, data: { id: data.id } };
}

export async function updateProject(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const parsed = projectFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = createAdminClient();
  const { error } = await sb
    .from("projects")
    .update({
      name: parsed.data.name,
      code: parsed.data.code,
      client_id: parsed.data.client_id,
      status: parsed.data.status,
      description: parsed.data.description ?? null,
      start_date: parsed.data.start_date ?? null,
      end_date: parsed.data.end_date ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: GENERIC_DB_ERROR };
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
  revalidateTag("admin-layout", "max");
  revalidateTag("workspace-layout", "max");
  revalidateTag(ADMIN_CACHE_TAGS.projects, "max");
  return { ok: true };
}

export async function archiveProject(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createAdminClient();
  const { error } = await sb
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: GENERIC_DB_ERROR };
  revalidatePath("/admin/projects");
  revalidateTag("admin-layout", "max");
  revalidateTag("workspace-layout", "max");
  revalidateTag(ADMIN_CACHE_TAGS.projects, "max");
  return { ok: true };
}

export async function restoreProject(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createAdminClient();
  const { error } = await sb
    .from("projects")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: GENERIC_DB_ERROR };
  revalidatePath("/admin/projects");
  revalidateTag("admin-layout", "max");
  revalidateTag("workspace-layout", "max");
  revalidateTag(ADMIN_CACHE_TAGS.projects, "max");
  return { ok: true };
}

// Hard-delete a project. Removes the row (and cascades to phases, activities,
// proofs, members, budgets, etc. via FK ON DELETE CASCADE). Irreversible.
export async function deleteProject(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createAdminClient();
  const { error } = await sb.from("projects").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/projects");
  revalidatePath("/admin");
  revalidateTag("admin-layout", "max");
  revalidateTag("workspace-layout", "max");
  revalidateTag(ADMIN_CACHE_TAGS.projects, "max");
  return { ok: true };
}
