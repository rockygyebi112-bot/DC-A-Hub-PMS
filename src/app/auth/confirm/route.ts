import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import {
  checkRateLimit,
  extractClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";

/**
 * Stateless email confirmation endpoint for Supabase recovery / invite /
 * email-change links.
 *
 * Unlike `/auth/callback` (which uses the PKCE `?code=` exchange and
 * therefore requires the original browser's `code_verifier` cookie), this
 * route consumes a `token_hash` issued by Supabase and verifies it via
 * `verifyOtp`. The token is single-use and bound to the user, so the link
 * works even when opened on a different device or browser - the common
 * case for password-reset emails.
 *
 * Email templates (Supabase Dashboard → Authentication → Email Templates)
 * should point at this route, e.g.:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
 */

// Allowlist the OTP types we actually issue. Casting an arbitrary query-string
// value to `EmailOtpType` lets unexpected flow semantics through to Supabase
// (e.g. `phone_change` from a route only ever invoked for email-bound flows),
// which can have surprising side effects. Reject anything we didn't mint.
const ALLOWED_TYPES = new Set<EmailOtpType>([
  "recovery",
  "invite",
  "email_change",
  "signup",
  "magiclink",
]);

const MAX_TOKEN_HASH_LENGTH = 1024;

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const token_hash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type");
  const next = safeRedirectPath(url.searchParams.get("next"), "/");

  if (!token_hash || !rawType) {
    return NextResponse.redirect(new URL(`/login?error=auth`, url.origin));
  }
  if (token_hash.length > MAX_TOKEN_HASH_LENGTH) {
    return NextResponse.redirect(new URL(`/login?error=auth`, url.origin));
  }
  if (!ALLOWED_TYPES.has(rawType as EmailOtpType)) {
    return NextResponse.redirect(new URL(`/login?error=auth`, url.origin));
  }
  const type = rawType as EmailOtpType;

  // Per-IP rate limit on OTP verification. Tokens are short-lived but the
  // limiter is the only thing protecting against burn-through and CPU
  // exhaustion on the verify path. Fail-closed bucket.
  const ip = extractClientIp(request.headers);
  const ipHash = ip
    ? createHash("sha256").update(ip).digest("hex").slice(0, 16)
    : "noip";
  const rl = await checkRateLimit("otp-verify", `ip:${ipHash}`, 30, 600);
  if (!rl.ok) {
    const target = new URL(`/login?error=rate_limited`, url.origin);
    target.searchParams.set(
      "message",
      rateLimitMessage(rl.retryAfterSeconds, "Too many verification attempts"),
    );
    return NextResponse.redirect(target);
  }

  const supabase = await createClient();

  // Always drop the local session before any verifyOtp. If the link is opened
  // in a browser logged into a DIFFERENT account, leaving that session intact
  // can cause the verified action (password reset, email change, invite
  // acceptance) to land on the wrong identity. Sign-out first, verify second,
  // and the freshly verified session takes over cleanly.
  await supabase.auth.signOut({ scope: "local" });

  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    const target =
      type === "recovery"
        ? "/forgot-password?error=link_expired"
        : `/login?error=auth`;
    return NextResponse.redirect(new URL(target, url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
