import "server-only";

import { requireAuth, type GuardResult } from "./guards";

export type AppRole = 'admin' | 'staff' | 'client';

/**
 * Require the caller to hold one of the listed roles. Accepts either a single
 * role string ("admin") or an array (["admin", "staff"]) so server actions can
 * gate on either a specific role or a role-set without per-call branching.
 *
 * Returns the canonical {@link GuardResult} shape used by every other guard so
 * action call sites can use a uniform `if (!auth.ok) return auth;` pattern.
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

export function resolveHomeForRole(role: AppRole | null): string {
  if (role === 'admin') return '/admin';
  if (role === 'staff') return '/workspace';
  if (role === 'client') return '/portal';
  return '/login';
}

export function isRoleAllowed(
  role: AppRole | null,
  allowed: AppRole[],
): boolean {
  if (role === null) return false;
  return allowed.includes(role);
}
