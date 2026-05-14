"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email/send";
import { renderPasswordResetEmail } from "@/lib/email/templates/password-reset";

export type ForgotPasswordResult =
  | { ok: true }
  | { ok: false; error: string };

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

/**
 * Initiate a password reset for `email`.
 *
 * Behaviour notes:
 * - Always returns `{ ok: true }` for non-existent addresses to avoid leaking
 *   which emails are registered (account enumeration). Real send failures
 *   (e.g. Resend outage) still surface as `{ ok: false }`.
 * - Uses Supabase admin `generateLink` so no email is sent by Supabase; we
 *   deliver the link ourselves through Resend.
 */
export async function requestPasswordReset(
  raw: unknown,
): Promise<ForgotPasswordResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const admin = createAdminClient();
  const appUrl = getAppUrl();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: parsed.data.email,
    options: {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    // Treat "user not found" silently to avoid account enumeration.
    if (msg.includes("not found") || msg.includes("no user")) {
      return { ok: true };
    }
    return { ok: false, error: "Could not start password reset. Try again." };
  }

  const hashedToken = data.properties?.hashed_token;
  const userId = data.user?.id;
  if (!hashedToken || !userId) {
    // Same silent treatment - never reveal whether the address exists.
    return { ok: true };
  }

  const params = new URLSearchParams({
    token_hash: hashedToken,
    type: "recovery",
    next: "/reset-password",
  });
  const resetUrl = `${appUrl}/auth/confirm?${params.toString()}`;
  const tpl = renderPasswordResetEmail({ resetUrl, isInitialSetup: false });

  const result = await sendEmail({
    to: parsed.data.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    category: "password_reset",
    // Bucket the timestamp to the minute so a burst of retries inside a
    // single minute dedupe at Resend (protecting reputation + inbox), while
    // genuinely separate user-driven resets minutes apart still each fire.
    idempotencyKey: `password-reset/${userId}/${Math.floor(Date.now() / 60_000)}`,
  });
  if (!result.ok) {
    return { ok: false, error: "Could not send reset email. Try again." };
  }
  return { ok: true };
}
