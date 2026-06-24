import type { NextConfig } from "next";

/**
 * Security headers applied to every response. CSP is set statically here so it
 * covers EVERY route (including /login, /api, /auth) uniformly — the existing
 * `proxy.ts` matcher deliberately skips those paths for Vercel quota reasons,
 * so it is not a complete place to attach a per-request policy.
 *
 * KNOWN GAP: `script-src` still includes `'unsafe-inline'`, which blunts CSP's
 * XSS protection. The proper fix is a per-request nonce (`'nonce-…'
 * 'strict-dynamic'`), but in Next 16 that must be minted in `proxy.ts` AND the
 * proxy matcher widened to cover document routes it currently excludes, then
 * verified end-to-end (dev needs `'unsafe-eval'`; prod must not). That is a
 * focused, separately-verified change — tracked rather than bundled here.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseConnect = SUPABASE_URL ? ` ${SUPABASE_URL}` : "";

const CSP = [
  "default-src 'self'",
  // See KNOWN GAP above — 'unsafe-inline' is a deliberate, documented stopgap
  // until the nonce migration lands. 'unsafe-eval' is intentionally excluded.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${supabaseConnect} https: wss:`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // M-14 — extra hardening headers. COEP=require-corp is intentionally NOT
  // set globally because it would block Supabase storage URLs without the
  // matching CORP header. Add it per-route once we measure compatibility.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-Download-Options", value: "noopen" },
  { key: "Origin-Agent-Cluster", value: "?1" },
];

const nextConfig: NextConfig = {
  turbopack: {},
  // The AI-agents API route reads the Claude Code skill markdown at runtime
  // (`.claude/skills/**`). Next only bundles files it can statically see being
  // imported, so trace these in explicitly or they're missing in production.
  outputFileTracingIncludes: {
    "/api/agents/[agent]/run": [".claude/skills/**/*.md"],
  },
  images: {
    // Cache optimized images for 31 days. Default is 60s which causes the
    // same source image to be re-transformed repeatedly, burning through the
    // Vercel Hobby plan's 5K transformations/month quota.
    minimumCacheTTL: 2678400,
    // Trim the set of widths Next.js will generate so a single <Image> source
    // produces fewer cached variants. The defaults emit 8 device + 8 image
    // sizes; we cover phone / tablet / desktop / retina with these.
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [64, 128, 256, 384],
    // Serve next-gen formats first. AVIF compresses ~30% smaller than WebP
    // on average; both are universally supported by modern browsers and
    // Next.js falls back to the original PNG/JPG for older clients.
    formats: ["image/avif", "image/webp"],
    // Allow next/image to optimise Supabase storage URLs (client logos,
    // avatars, etc). Without this every remote image had to opt out via
    // `unoptimized` which bypassed AVIF/WebP transformation entirely and
    // burned bandwidth on full-size PNGs. The wildcard covers project and
    // preview Supabase refs alike; storage paths always sit under the
    // `/storage/v1/object/...` prefix.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Long-lived caching for our static brand assets in /public. The CDN
        // can serve repeat hits without going back to the build output, which
        // saves Fast Origin Transfer and Function Invocations.
        source: "/:asset(programs|icons|logo\\.png|srsf-logo\\.png|favicon-32\\.png|apple-touch-icon\\.png|ghana-coat-of-arms\\.svg|file\\.svg|globe\\.svg|next\\.svg|vercel\\.svg|window\\.svg|manifest\\.json)/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/(logo\\.png|srsf-logo\\.png|favicon-32\\.png|apple-touch-icon\\.png|manifest\\.json)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
