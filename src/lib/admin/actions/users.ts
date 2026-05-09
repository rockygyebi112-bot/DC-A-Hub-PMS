"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import {
  inviteUserSchema,
  setUserRoleSchema,
} from "@/lib/admin/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function assertCallerIsAdmin(): Promise<string | null> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  return data?.role === "admin" ? user.id : null;
}

export async function inviteUser(
  raw: unknown,
): Promise<ActionResult<{ user_id: string; profile_id: string }>> {
  const parsed = inviteUserSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const callerId = await assertCallerIsAdmin();
  if (!callerId) return { ok: false, error: "Not authorized" };

  const admin = createAdminClient();
  const { data: invite, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${getAppUrl()}/reset-password`,
    });

  if (inviteErr) {
    if (!inviteErr.message.toLowerCase().includes("already")) {
      return { ok: false, error: inviteErr.message };
    }
  }

  let userId = invite?.user?.id;
  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers();
    userId = list.users.find((u) => u.email === parsed.data.email)?.id;
    if (!userId) {
      return { ok: false, error: "Invite sent but could not resolve user id" };
    }
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        email: parsed.data.email,
        full_name: parsed.data.full_name ?? parsed.data.email,
        role: parsed.data.role,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();
  if (profileErr) return { ok: false, error: profileErr.message };

  revalidatePath("/admin/users");
  return { ok: true, data: { user_id: userId, profile_id: profile.id } };
}

export async function setUserRole(
  profileId: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = setUserRoleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
  const { error } = await sb
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", profileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${profileId}`);
  return { ok: true };
}

export async function deactivateUser(profileId: string): Promise<ActionResult> {
  const callerId = await assertCallerIsAdmin();
  if (!callerId) return { ok: false, error: "Not authorized" };

  const admin = createAdminClient();
  const { data: profile, error: getErr } = await admin
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .single();
  if (getErr) return { ok: false, error: getErr.message };
  if (profile.user_id === callerId) {
    return { ok: false, error: "You cannot deactivate yourself" };
  }

  const { error: banErr } = await admin.auth.admin.updateUserById(
    profile.user_id,
    { ban_duration: "876000h" },
  );
  if (banErr) return { ok: false, error: banErr.message };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ is_active: false })
    .eq("id", profileId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${profileId}`);
  return { ok: true };
}

export async function reactivateUser(profileId: string): Promise<ActionResult> {
  const callerId = await assertCallerIsAdmin();
  if (!callerId) return { ok: false, error: "Not authorized" };

  const admin = createAdminClient();
  const { data: profile, error: getErr } = await admin
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .single();
  if (getErr) return { ok: false, error: getErr.message };

  const { error: unbanErr } = await admin.auth.admin.updateUserById(
    profile.user_id,
    { ban_duration: "none" },
  );
  if (unbanErr) return { ok: false, error: unbanErr.message };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ is_active: true })
    .eq("id", profileId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${profileId}`);
  return { ok: true };
}
