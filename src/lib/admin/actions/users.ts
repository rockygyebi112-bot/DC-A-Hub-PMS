"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { dbErrorMessage } from "@/lib/db-errors";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email/send";
import { renderInviteEmail } from "@/lib/email/templates/invite";
import { renderPasswordResetEmail } from "@/lib/email/templates/password-reset";
import {
  inviteUserSchema,
  setUserRoleSchema,
} from "@/lib/admin/schemas";
import type { ActionResult } from "@/lib/action-result";
import { PROFILE_ROLE_STATUS } from "@/lib/supabase/columns";

type InviteDelivery = "invite_sent" | "password_setup_sent";

/**
 * Returns the caller's user id if they are an active admin, otherwise null.
 * Thin adapter over the shared `requireAdmin()` guard — kept so the call
 * sites below don't have to destructure the GuardResult shape. The previous
 * inline implementation skipped the `is_active` check, which let deactivated
 * admins with a still-valid JWT continue calling admin server actions until
 * their token refreshed. `requireAdmin()` enforces is_active via the
 * single cached `getSessionUser()` entry, closing that window.
 */
async function assertCallerIsAdmin(): Promise<string | null> {
  const res = await requireAdmin();
  return res.ok ? res.userId : null;
}

export async function inviteUser(
  raw: unknown,
): Promise<
  ActionResult<{
    user_id: string;
    profile_id: string;
    delivery: InviteDelivery;
  }>
> {
  const parsed = inviteUserSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const callerId = await assertCallerIsAdmin();
  if (!callerId) return { ok: false, error: "Not authorized" };

  // C-4: 30 invites per 10 minutes per admin. Generous so onboarding a new
  // project doesn't trip the limit, tight enough to stop a compromised
  // admin token from being used to mail-bomb hundreds of addresses.
  const rl = await checkRateLimit("invite", callerId, 30, 600);
  if (!rl.ok) {
    return {
      ok: false,
      error: rateLimitMessage(rl.retryAfterSeconds, "Too many invites in a row"),
    };
  }

  const admin = createAdminClient();
  const appUrl = getAppUrl();

  // Try to generate an invite link first. This creates the auth.users row if
  // it doesn't exist and returns a hashed token we can deliver ourselves via
  // Resend. If the user already exists, generateLink errors and we fall back
  // to a password recovery link so the existing user can set/reset access.
  let delivery: InviteDelivery = "invite_sent";
  let userId: string | undefined;
  let hashedToken: string | undefined;

  const inviteLink = await admin.auth.admin.generateLink({
    type: "invite",
    email: parsed.data.email,
    options: {
      redirectTo: `${appUrl}/auth/callback?next=/accept-invite`,
      data: { full_name: parsed.data.full_name ?? null },
    },
  });

  if (inviteLink.error) {
    const msg = inviteLink.error.message.toLowerCase();
    const alreadyExists =
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists");
    if (!alreadyExists) {
      return { ok: false, error: inviteLink.error.message };
    }
    delivery = "password_setup_sent";
    const recoveryLink = await admin.auth.admin.generateLink({
      type: "recovery",
      email: parsed.data.email,
      options: {
        redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
      },
    });
    if (recoveryLink.error) {
      return { ok: false, error: recoveryLink.error.message };
    }
    userId = recoveryLink.data.user?.id;
    hashedToken = recoveryLink.data.properties?.hashed_token;
  } else {
    userId = inviteLink.data.user?.id;
    hashedToken = inviteLink.data.properties?.hashed_token;
  }

  if (!userId || !hashedToken) {
    return { ok: false, error: "Could not generate invitation link" };
  }

  // If this user already has a profile, do NOT overwrite role/full_name.
  // The previous upsert silently demoted any pre-existing admin/staff who
  // was "re-invited" as client — a privilege downgrade attack against
  // active accounts. Insert a new row only when one doesn't exist.
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  let profile: { id: string } | null = existingProfile;
  if (!existingProfile) {
    const { data: inserted, error: profileErr } = await admin
      .from("profiles")
      .insert({
        user_id: userId,
        email: parsed.data.email,
        full_name: parsed.data.full_name ?? parsed.data.email,
        role: parsed.data.role,
      })
      .select("id")
      .single();
    if (profileErr) return { ok: false, error: profileErr.message };
    profile = inserted;
  }
  if (!profile) return { ok: false, error: "Could not resolve profile" };

  // Construct the link pointing at our stateless `/auth/confirm` route, which
  // calls supabase.auth.verifyOtp with the hashed token and then redirects.
  const params = new URLSearchParams({
    token_hash: hashedToken,
    type: delivery === "invite_sent" ? "invite" : "recovery",
    next: delivery === "invite_sent" ? "/accept-invite" : "/reset-password",
  });
  const actionUrl = `${appUrl}/auth/confirm?${params.toString()}`;

  const tpl =
    delivery === "invite_sent"
      ? renderInviteEmail({
          inviteUrl: actionUrl,
          recipientName: parsed.data.full_name ?? undefined,
        })
      : renderPasswordResetEmail({ resetUrl: actionUrl, isInitialSetup: true });

  const sendResult = await sendEmail({
    to: parsed.data.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    category: delivery === "invite_sent" ? "invite" : "password_reset",
    // Per-user idempotency keyed on user id; the 24h window means a re-invite
    // after a day reuses a fresh key naturally.
    idempotencyKey:
      delivery === "invite_sent"
        ? `invite/${userId}`
        : `password-setup/${userId}/${Math.floor(Date.now() / 60_000)}`,
    extraTags: [{ name: "delivery", value: delivery }],
  });
  if (!sendResult.ok) return { ok: false, error: sendResult.error };

  revalidatePath("/admin/users");
  return {
    ok: true,
    data: { user_id: userId, profile_id: profile.id, delivery },
  };
}

export async function setUserRole(
  profileId: string,
  raw: unknown,
): Promise<ActionResult> {
  // CRIT-1: admin-only, otherwise any user could set role='admin' on their own
  // profile via the RLS-permissive self-update path.
  const callerId = await assertCallerIsAdmin();
  if (!callerId) return { ok: false, error: "Not authorized" };

  const parsed = setUserRoleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const admin = createAdminClient();

  // Prevent admins from accidentally demoting themselves, which can brick
  // the tenant (last-admin scenario is also enforced by a DB trigger).
  const { data: target } = await admin
    .from("profiles")
    .select(PROFILE_ROLE_STATUS)
    .eq("id", profileId)
    .single();
  if (!target) return { ok: false, error: "User not found" };
  if (target.user_id === callerId && parsed.data.role !== "admin") {
    return { ok: false, error: "You cannot demote yourself" };
  }

  // Last-admin guard (M-17): mirror the deleteUser check so demoting the
  // final active admin returns a friendly error instead of bricking the
  // tenant. The DB trigger is still authoritative — this just lets us
  // surface the case before the round-trip.
  if (
    target.role === "admin" &&
    target.is_active &&
    parsed.data.role !== "admin"
  ) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "Cannot demote the last active admin" };
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", profileId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
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

// Hard-delete a user. Removes the auth.users row first, then verifies the
// profile is gone. Deleting auth first prevents profile resurrection from
// auth/profile sync paths if the auth delete fails or is delayed.
export async function deleteUser(profileId: string): Promise<ActionResult> {
  const callerId = await assertCallerIsAdmin();
  if (!callerId) return { ok: false, error: "Not authorized" };

  const admin = createAdminClient();
  const { data: profile, error: getErr } = await admin
    .from("profiles")
    .select(PROFILE_ROLE_STATUS)
    .eq("id", profileId)
    .single();
  if (getErr) return { ok: false, error: getErr.message };
  if (profile.user_id === callerId) {
    return { ok: false, error: "You cannot delete your own account" };
  }

  // Last-admin guard mirrors the DB trigger so we can return a friendly error.
  if (profile.role === "admin" && profile.is_active) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "Cannot delete the last active admin" };
    }
  }

  const { error: delAuthErr } = await admin.auth.admin.deleteUser(
    profile.user_id,
  );
  if (delAuthErr) return { ok: false, error: delAuthErr.message };

  // The auth FK should cascade to profiles/project_members. Keep this explicit
  // cleanup as a safety net for projects whose database FK was not applied.
  const { error: delMembershipErr } = await admin
    .from("project_members")
    .delete()
    .eq("user_id", profile.user_id);
  if (delMembershipErr) return { ok: false, error: delMembershipErr.message };

  const { error: delProfileErr } = await admin
    .from("profiles")
    .delete()
    .or(`id.eq.${profileId},user_id.eq.${profile.user_id}`);
  if (delProfileErr) return { ok: false, error: delProfileErr.message };

  const { data: remainingProfile, error: verifyProfileErr } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", profile.user_id)
    .maybeSingle();
  if (verifyProfileErr) return { ok: false, error: verifyProfileErr.message };
  if (remainingProfile) {
    return {
      ok: false,
      error: "User auth was deleted, but the profile could not be removed.",
    };
  }

  revalidatePath("/admin/users");
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
