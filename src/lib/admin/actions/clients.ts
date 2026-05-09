"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { clientFormSchema } from "@/lib/admin/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const GENERIC_DB_ERROR = "Operation failed";

export async function createClientOrg(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsed = clientFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("clients")
    .insert({
      name: parsed.data.name,
      contact_email: parsed.data.contact_email ?? null,
      logo_url: parsed.data.logo_url ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: GENERIC_DB_ERROR };
  revalidatePath("/admin/clients");
  return { ok: true, data: { id: data.id } };
}

export async function updateClientOrg(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const parsed = clientFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const sb = createAdminClient();
  const { error } = await sb
    .from("clients")
    .update({
      name: parsed.data.name,
      contact_email: parsed.data.contact_email ?? null,
      logo_url: parsed.data.logo_url ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: GENERIC_DB_ERROR };
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  return { ok: true };
}

export async function archiveClient(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createAdminClient();
  const { error } = await sb
    .from("clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message || GENERIC_DB_ERROR };
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  return { ok: true };
}

export async function restoreClient(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createAdminClient();
  const { error } = await sb
    .from("clients")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message || GENERIC_DB_ERROR };
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  return { ok: true };
}

export async function deleteClientOrg(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const sb = createAdminClient();
  const { count, error: countError } = await sb
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("client_id", id);
  if (countError) {
    return { ok: false, error: countError.message || GENERIC_DB_ERROR };
  }
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error:
        "This client has projects attached. Archive the client instead, or move/delete those projects first.",
    };
  }

  const { error } = await sb.from("clients").delete().eq("id", id);
  if (error) return { ok: false, error: error.message || GENERIC_DB_ERROR };

  revalidatePath("/admin/clients");
  return { ok: true };
}
