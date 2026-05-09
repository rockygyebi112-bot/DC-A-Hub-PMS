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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
