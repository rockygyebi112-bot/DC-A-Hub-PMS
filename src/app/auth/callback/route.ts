import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import {
  checkRateLimit,
  extractClientIp,
  rateLimitMessage,
} from "@/lib/rate-limit";

// PKCE / OAuth codes from Supabase are short. Reject anything wildly longer
// than the realistic envelope so an attacker can't pin the server with
// pathological inputs.
const MAX_CODE_LENGTH = 512;

// Routes that must NOT inherit a stale session: opening a reset / accept-
// invite link while logged in as a different user would otherwise leave the
// caller authenticated as that prior identity and apply the new credentials
// to it. Strip the query string before comparing so `?next=/reset-password?x=y`
// can't slip past the equality check.
const SIGN_OUT_NEXT_PREFIXES = ["/reset-password", "/accept-invite"];

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  // Clamp `next` to a same-origin absolute path. This blocks open redirects
  // such as `?next=//evil.com/...` which the `URL` constructor would otherwise
  // resolve to a remote origin when given a base URL.
  const next = safeRedirectPath(url.searchParams.get("next"), "/");

  if (code) {
    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.redirect(new URL(`/login?error=auth`, url.origin));
    }

    // Per-IP rate limit on the code exchange. Without this an attacker can
    // brute-force codes / DoS via repeated expensive Supabase round-trips.
    // Fail-closed bucket (see FAIL_CLOSED_BUCKETS in rate-limit.ts).
    const hdrs = request.headers;
    const ip = extractClientIp(hdrs);
    const ipHash = ip
      ? createHash("sha256").update(ip).digest("hex").slice(0, 16)
      : "noip";
    const rl = await checkRateLimit(
      "auth-callback",
      `ip:${ipHash}`,
      60,
      600,
    );
    if (!rl.ok) {
      const target = new URL(`/login?error=rate_limited`, url.origin);
      target.searchParams.set(
        "message",
        rateLimitMessage(rl.retryAfterSeconds, "Too many sign-in attempts"),
      );
      return NextResponse.redirect(target);
    }

    const supabase = await createClient();
    // Strip any query string before comparing so a crafted `?next=/reset-password?x=y`
    // path doesn't bypass the local sign-out. `safeRedirectPath` already
    // normalized the value to a same-origin absolute path; we just need the
    // pathname portion for the prefix check.
    const nextPath = next.split("?")[0];
    if (SIGN_OUT_NEXT_PREFIXES.some((p) => nextPath === p || nextPath.startsWith(`${p}/`))) {
      await supabase.auth.signOut({ scope: "local" });
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=auth`, url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
