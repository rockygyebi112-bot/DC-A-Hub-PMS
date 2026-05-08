"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { projectFormSchema } from "@/lib/admin/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function createProject(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = projectFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
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
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/projects");
  return { ok: true, data: { id: data.id } };
}

export async function updateProject(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = projectFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
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
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
  return { ok: true };
}

export async function archiveProject(id: string): Promise<ActionResult> {
  const sb = await createClient();
  const { error } = await sb
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/projects");
  return { ok: true };
}

export async function restoreProject(id: string): Promise<ActionResult> {
  const sb = await createClient();
  const { error } = await sb
    .from("projects")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/projects");
  return { ok: true };
}
