import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { decideRedirect } from "@/lib/auth/decide-redirect";
import type { AppRole } from "@/lib/auth/require-role";

/**
 * Next.js proxy (formerly middleware) - enforces role-based surface separation
 * and refreshes the Supabase auth cookie on every request.
 *
 * Defence-in-depth: each app layout also calls `getCurrentProfile()` and
 * redirects, but the proxy stops attackers who craft a direct request to a
 * surface they should not reach, such as a client hitting /admin.
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let static assets and auth endpoints through untouched.
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Build a response object we can mutate cookies on, per @supabase/ssr docs.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: AppRole | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("user_id", user.id)
      .single();
    // Deactivated users are treated as signed out for routing purposes.
    if (data && data.is_active !== false) {
      role = data.role as AppRole;
    }
  }

  const redirectPath = decideRedirect({ pathname, role });
  if (redirectPath && redirectPath !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
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
