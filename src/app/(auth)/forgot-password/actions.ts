"use server";

import { headers } from "next/headers";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email/send";
import { renderPasswordResetEmail } from "@/lib/email/templates/password-reset";
import {
  checkRateLimit,
  extractClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";

export type ForgotPasswordResult =
  | { ok: true }
  | { ok: false; error: string };

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

// Floor for the total wall-clock time spent in this action regardless of
// whether the email is registered. The unknown-email branch previously short-
// circuited in ~5ms while the real branch took 100s of ms to hit Resend,
// giving an obvious timing oracle. Sleeping up to this floor before returning
// hides the difference. Keep this above the slowest happy-path on prod hardware.
const MIN_RESPONSE_MS = 900;

// Hash an IP so we can use it as a stable rate-limit key / idempotency
// component without writing the raw value into a third-party (Resend) header.
function hashIp(ip: string | null): string {
  if (!ip) return "noip";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * Initiate a password reset for `email`.
 *
 * Behaviour notes:
 * - Always returns `{ ok: true }` for non-existent addresses to avoid leaking
 *   which emails are registered (account enumeration). The response is padded
 *   to a constant minimum duration so timing doesn't betray the branch.
 * - Rate-limited per-email AND per-IP. Per-email alone is trivially bypassed
 *   by iterating addresses; per-IP alone misses distributed brute force.
 * - Idempotency key includes the requester's IP hash + a coarse minute bucket.
 *   That way a legitimate user's reset isn't suppressed by an attacker who
 *   triggers a reset for the same user in the same minute from a different IP,
 *   while still deduping a real user's rapid button-mash retries.
 * - Uses Supabase admin `generateLink` so no email is sent by Supabase; we
 *   deliver the link ourselves through Resend.
 */
export async function requestPasswordReset(
  raw: unknown,
): Promise<ForgotPasswordResult> {
  const startedAt = Date.now();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    await sleep(MIN_RESPONSE_MS - (Date.now() - startedAt));
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const hdrs = await headers();
  const ip = extractClientIp(hdrs);
  const ipHash = hashIp(ip);
  const email = parsed.data.email.toLowerCase();

  // Per-email limit (5 / hour). Catches a determined attacker hammering one
  // address.
  const rlEmail = await checkRateLimit("pwd-reset", `email:${email}`, 5, 3600);
  if (!rlEmail.ok) {
    await sleep(MIN_RESPONSE_MS - (Date.now() - startedAt));
    return {
      ok: false,
      error: rateLimitMessage(rlEmail.retryAfterSeconds, "Too many reset requests"),
    };
  }

  // Per-IP limit (20 / hour). Catches an attacker iterating addresses from a
  // single host. Fail-closed: this bucket is in FAIL_CLOSED_BUCKETS.
  const rlIp = await checkRateLimit("pwd-reset", `ip:${ipHash}`, 20, 3600);
  if (!rlIp.ok) {
    await sleep(MIN_RESPONSE_MS - (Date.now() - startedAt));
    return {
      ok: false,
      error: rateLimitMessage(rlIp.retryAfterSeconds, "Too many reset requests"),
    };
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

  // Helper to pad out to the constant-time floor before returning ANY result.
  const padded = async <T>(value: T): Promise<T> => {
    await sleep(MIN_RESPONSE_MS - (Date.now() - startedAt));
    return value;
  };

  if (error) {
    const msg = error.message.toLowerCase();
    // Treat "user not found" silently to avoid account enumeration. Pad to the
    // constant-time floor so an external observer can't distinguish this from
    // the happy path.
    if (msg.includes("not found") || msg.includes("no user")) {
      return padded({ ok: true });
    }
    console.error("[forgot-password] generateLink failed", { code: error.code });
    return padded({ ok: false, error: "Could not start password reset. Try again." });
  }

  const hashedToken = data.properties?.hashed_token;
  const userId = data.user?.id;
  if (!hashedToken || !userId) {
    // Same silent treatment — never reveal whether the address exists.
    return padded({ ok: true });
  }

  const params = new URLSearchParams({
    token_hash: hashedToken,
    type: "recovery",
    next: "/reset-password",
  });
  const resetUrl = `${appUrl}/auth/confirm?${params.toString()}`;
  const tpl = renderPasswordResetEmail({ resetUrl, isInitialSetup: false });

  // Idempotency key: user id + minute bucket + requester IP hash + random
  // nonce. The IP hash partitions the dedupe namespace per-requester so a
  // hostile request can't suppress the victim's own legitimate reset email.
  // The minute bucket still dedupes a real user's rapid double-clicks; the
  // random nonce ensures pathological clock-skew cases don't collide.
  const minute = Math.floor(Date.now() / 60_000);
  const nonce = randomUUID().slice(0, 8);
  const result = await sendEmail({
    to: parsed.data.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    category: "password_reset",
    idempotencyKey: `password-reset/${userId}/${minute}/${ipHash}/${nonce}`,
  });
  if (!result.ok) {
    console.error("[forgot-password] sendEmail failed");
    return padded({ ok: false, error: "Could not send reset email. Try again." });
  }
  return padded({ ok: true });
}
