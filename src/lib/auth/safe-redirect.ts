/**
 * Validate a post-auth redirect target.
 *
 * Accept ONLY same-origin, absolute-path URLs whose first segment is on a
 * known allowlist (admin, workspace, portal, account, accept-invite,
 * reset-password). Anything else falls back to "/".
 *
 * `URL` in Node/browsers treats "//evil.com" with a base as a new origin, so
 * we cannot rely on the `URL` constructor — we must string-validate first.
 */
const ALLOWED_ROOT_SEGMENTS = new Set([
  "admin",
  "workspace",
  "portal",
  "account",
  "accept-invite",
  "reset-password",
]);

export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed === "") return fallback;

  // Must start with a single forward slash and not two (protocol-relative),
  // nor a backslash (some browsers normalise "/\\" to "//").
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.startsWith("/\\")) return fallback;

  // Disallow embedded control characters (NUL..US, DEL) that could confuse
  // downstream parsers.
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return fallback;
  }

  // Allowlist the top-level segment. Open-redirect surface is limited to the
  // app's own audience trees, even if an attacker controls `?next=`.
  const path = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
  const firstSegment = path.split("/")[1] ?? "";
  if (!ALLOWED_ROOT_SEGMENTS.has(firstSegment)) return fallback;

  return trimmed;
}
