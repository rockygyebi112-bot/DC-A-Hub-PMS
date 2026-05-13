import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js proxy (formerly middleware).
 *
 * PERFORMANCE: This used to call `supabase.auth.getUser()` and SELECT
 * from `profiles` on every page navigation — adding two Supabase
 * round-trips to the edge function's critical path (~200-500ms per
 * request) and burning a large chunk of the Vercel Hobby quota.
 *
 * The middleware is now a cheap cookie-only check:
 *   - No session cookie + protected path → redirect to /login.
 *   - Everything else passes through.
 *
 * Authoritative authn/authz still runs in every protected layout via
 * `getCurrentProfile()`, which validates the JWT with Supabase and
 * redirects based on role. A staff user typing `/admin` directly will
 * therefore still be bounced to `/workspace` — just one render later,
 * by the admin layout instead of by the edge function. This is the
 * standard "verify in middleware cheap, enforce in RSC/layout
 * authoritative" pattern recommended by Supabase + Next.js.
 */

const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/accept-invite",
  "/auth",
  "/api",
  "/_next",
  "/favicon.ico",
  "/logo.png",
  "/manifest.json",
  "/icons",
  "/programs",
  "/srsf-logo.png",
];

const PROTECTED_PREFIXES = ["/admin", "/workspace", "/portal", "/account"];

// Supabase stores its auth token in a cookie named like
// `sb-<project_ref>-auth-token`. When the token is large it can be
// split into chunks named `…-auth-token.0`, `…-auth-token.1`, etc.
const SUPABASE_AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let static assets and auth endpoints through untouched.
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Cheap cookie-presence check — no network calls. The cookie value
  // is NOT trusted here; the layout's `getCurrentProfile()` validates
  // the JWT before rendering any protected data.
  const hasSession = request.cookies
    .getAll()
    .some((c) => SUPABASE_AUTH_COOKIE.test(c.name));

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!hasSession && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      // Exclude paths that never need the auth/role check at the matcher level
      // so the proxy function is not invoked at all. This protects our Vercel
      // Hobby quotas (Edge Requests + Function Invocations) by skipping:
      //   - API routes (they enforce their own auth)
      //   - Next.js internals (_next/*)
      //   - Public auth pages (login, forgot-password, reset-password, accept-invite, /auth callbacks)
      //   - Static files in /public (logos, manifest, icons, programs)
      //   - Anything ending in a static asset extension
      source:
        "/((?!api|_next|auth|login|forgot-password|reset-password|accept-invite|favicon\\.ico|logo\\.png|srsf-logo\\.png|manifest\\.json|icons|programs|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|json|xml|txt|woff|woff2|ttf|otf|map)).*)",
      // Skip RSC prefetch requests entirely. Defence-in-depth is preserved by
      // the layout-level getCurrentProfile() checks on actual navigation.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
