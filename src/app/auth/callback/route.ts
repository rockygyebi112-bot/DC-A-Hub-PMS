import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  // Clamp `next` to a same-origin absolute path. This blocks open redirects
  // such as `?next=//evil.com/...` which the `URL` constructor would otherwise
  // resolve to a remote origin when given a base URL.
  const next = safeRedirectPath(url.searchParams.get("next"), "/");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=auth`, url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
