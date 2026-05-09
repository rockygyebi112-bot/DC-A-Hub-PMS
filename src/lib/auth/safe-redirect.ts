/**
 * Validate a post-auth redirect target.
 *
 * Accept ONLY same-origin, absolute-path URLs (e.g. "/admin", "/workspace").
 * Reject:
 *   - absolute URLs                  ("https://evil.com/...")
 *   - protocol-relative URLs         ("//evil.com/...")
 *   - back-slash tricks              ("/\\evil.com")
 *   - non-path schemes               ("javascript:alert(1)", "data:...")
 *
 * `URL` in Node/browsers treats "//evil.com" with a base as a new origin, so
 * we cannot rely on the `URL` constructor — we must string-validate first.
 */
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

  // Disallow embedded control characters that could confuse downstream parsers.
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return fallback;

  return trimmed;
}
