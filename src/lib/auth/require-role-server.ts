import "server-only";

import { requireAuth, type GuardResult } from "./guards";
import type { AppRole } from "./require-role";

/**
 * Require the caller to hold one of the listed roles. Accepts either a single
 * role string ("admin") or an array (["admin", "staff"]) so server actions can
 * gate on either a specific role or a role-set without per-call branching.
 *
 * Returns the canonical {@link GuardResult} shape used by every other guard so
 * action call sites can use a uniform `if (!auth.ok) return auth;` pattern.
 *
 * Server-only: lives in its own file so the pure helpers in `./require-role`
 * stay importable from non-server contexts (tests, client components that
 * only need `resolveHomeForRole`/`isRoleAllowed`).
 */
export async function requireRole(
  allowed: AppRole | AppRole[],
): Promise<GuardResult> {
  const res = await requireAuth();
  if (!res.ok) return res;
  const list = Array.isArray(allowed) ? allowed : [allowed];
  if (!list.includes(res.role)) {
    return { ok: false, error: "Not authorized" };
  }
  return res;
}
