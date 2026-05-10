import type { NextConfig } from "next";

/**
 * Security headers applied to every response. CSP intentionally omitted from
 * middleware (which runs on the edge) so it can include `unsafe-inline` for
 * Next's dev runtime; tighten via a separate `Content-Security-Policy-Report-Only`
 * once all inline script sources have been enumerated.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseConnect = SUPABASE_URL ? ` ${SUPABASE_URL}` : "";

const CSP = [
  "default-src 'self'",
  // Next.js + React runtime requires inline scripts for hydration; nonces
  // would be cleaner but require per-request injection. Revisit once the
  // upgrade path is clear.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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
];

const nextConfig: NextConfig = {
  turbopack: {},
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
