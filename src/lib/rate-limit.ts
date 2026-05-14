import "server-only";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Sliding-window rate limit backed by the `rate_limit_events` table
 * (migration 0027). Calls the SECURITY DEFINER `try_consume` function via
 * the service-role client. The function is the only thing that ever reads
 * or writes that table.
 *
 * Use composite keys like `pwd-verify:${userId}` or `pwd-reset:${email}`.
 *
 * Buckets are conventionally one of:
 *   - "pwd-verify"   — re-auth via signInWithPassword
 *   - "pwd-reset"    — forgot-password mail
 *   - "email-change" — updateMyEmail
 *   - "invite"       — admin inviteUser
 *
 * Failures (e.g. DB unreachable) are treated as `{ ok: true }` so a
 * transient outage in the rate-limit path does not lock everyone out.
 * The audit and authn checks downstream are still enforced.
 */
export async function checkRateLimit(
  bucket: string,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient();
    // The generated DB types don't yet know about try_consume / the rate-limit
    // tables (migration 0027). Drop to untyped at the boundary; the function
    // signature is asserted via the returned shape below. Run `supabase gen
    // types typescript` after applying 0027 to remove this cast.
    const adminAny = admin as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
    const { data, error } = await adminAny.rpc("try_consume", {
      p_bucket: bucket,
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] try_consume failed", error);
      return { ok: true };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.ok) return { ok: true };
    return { ok: false, retryAfterSeconds: row?.retry_after_seconds ?? windowSeconds };
  } catch (err) {
    console.error("[rate-limit] try_consume threw", err);
    return { ok: true };
  }
}

/**
 * Append one row to `password_verify_attempts` for every re-auth attempt
 * (success or failure). Best-effort: a logging failure must not block the
 * actual auth flow — but it's logged to the server console.
 */
export async function logPasswordVerifyAttempt(args: {
  userId: string | null;
  email: string | null;
  success: boolean;
  context: string;
}): Promise<void> {
  try {
    const hdrs = await headers();
    const userAgent = hdrs.get("user-agent");
    const fwd = hdrs.get("x-forwarded-for");
    const ip = fwd ? fwd.split(",")[0]?.trim() || null : null;
    const admin = createAdminClient();
    // Same generated-types story as try_consume above.
    const adminAny = admin as unknown as {
      from: (table: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await adminAny.from("password_verify_attempts").insert({
      user_id: args.userId,
      email: args.email,
      success: args.success,
      ip_address: ip,
      user_agent: userAgent,
      context: args.context,
    });
    if (error) console.error("[rate-limit] password_verify_attempts insert failed", error);
  } catch (err) {
    console.error("[rate-limit] password_verify_attempts insert threw", err);
  }
}

/** Pretty user-facing message for a rate-limited response. */
export function rateLimitMessage(retryAfterSeconds: number, what = "Too many attempts"): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  if (minutes >= 2) {
    return `${what}. Try again in about ${minutes} minutes.`;
  }
  return `${what}. Try again in a minute.`;
}
