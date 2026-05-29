import "server-only";

/**
 * CSRF defence for mutating Route Handlers.
 *
 * Route Handlers (unlike Next.js Server Actions) get NO automatic Origin
 * enforcement, so every state-changing POST/PUT/DELETE handler must call this
 * before reading the body. Supabase's default `SameSite=Lax` cookies already
 * block most cross-site POSTs, but that is implicit platform behaviour — this
 * is the explicit, defence-in-depth gate.
 *
 * Logic: prefer `Sec-Fetch-Site` (attached by modern browsers on every fetch
 * and not script-spoofable); "same-origin" is the canonical signal. If absent
 * (older client / non-browser caller) fall back to a host-equality check on
 * Origin then Referer. If none are present we refuse — better to break an
 * unusual client than accept a forgeable cross-origin write.
 */
export function isSameOrigin(request: Request): boolean {
  const sfs = request.headers.get("sec-fetch-site");
  if (sfs) return sfs === "same-origin";

  const target = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === target.host;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === target.host;
    } catch {
      return false;
    }
  }
  return false;
}
