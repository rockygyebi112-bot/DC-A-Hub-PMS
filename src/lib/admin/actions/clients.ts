"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clientFormSchema } from "@/lib/admin/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function createClientOrg(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = clientFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const sb = await createClient();
  const { data, error } = await sb
    .from("clients")
    .insert({
      name: parsed.data.name,
      contact_email: parsed.data.contact_email ?? null,
      logo_url: parsed.data.logo_url ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/clients");
  return { ok: true, data: { id: data.id } };
}

export async function updateClientOrg(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = clientFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const sb = await createClient();
  const { error } = await sb
    .from("clients")
    .update({
      name: parsed.data.name,
      contact_email: parsed.data.contact_email ?? null,
      logo_url: parsed.data.logo_url ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  return { ok: true };
}

export async function archiveClient(id: string): Promise<ActionResult> {
  const sb = await createClient();
  const { error } = await sb
    .from("clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/clients");
  return { ok: true };
}

export async function restoreClient(id: string): Promise<ActionResult> {
  const sb = await createClient();
  const { error } = await sb
    .from("clients")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/clients");
  return { ok: true };
}
