import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

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
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeRedirectPath(url.searchParams.get("next"), "/");

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL(`/login?error=auth`, url.origin));
  }

  const supabase = await createClient();

  // For recovery / invite, drop any existing session so the user always
  // lands on the reset / accept-invite flow with the freshly verified
  // identity rather than a stale one.
  if (type === "recovery" || type === "invite") {
    await supabase.auth.signOut({ scope: "local" });
  }

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
