import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "./session";
import type { AppRole } from "./require-role";

export type GuardResult =
  | { ok: true; userId: string; role: AppRole }
  | { ok: false; error: string };

/**
 * Returns the authenticated user's id and role, or an error result.
 * All server actions MUST start with an identity check — we never trust
 * the caller to be who the UI says they are.
 *
 * Goes through `getSessionUser()` so layout + page + this guard share a
 * single Supabase round-trip per request. Previously each call paid for
 * its own `auth.getUser()` + `profiles` select round-trip.
 */
export async function requireAuth(): Promise<GuardResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (!user.isActive) return { ok: false, error: "Account disabled" };
  return { ok: true, userId: user.userId, role: user.role };
}

/** Require the caller to be an admin. */
export async function requireAdmin(): Promise<GuardResult> {
  const res = await requireAuth();
  if (!res.ok) return res;
  if (res.role !== "admin") return { ok: false, error: "Not authorized" };
  return res;
}

/** Require the caller to be an admin or staff member (workspace surface). */
export async function requireStaffOrAdmin(): Promise<GuardResult> {
  const res = await requireAuth();
  if (!res.ok) return res;
  if (res.role !== "admin" && res.role !== "staff")
    return { ok: false, error: "Not authorized" };
  return res;
}

/**
 * Require write access to a specific project. Admins always pass; non-admins
 * must have a project_members row with project_role = 'member'.
 */
export async function requireProjectWriter(
  projectId: string,
): Promise<GuardResult> {
  const res = await requireAuth();
  if (!res.ok) return res;
  if (res.role === "admin") return res;

  const sb = await createClient();
  const { data } = await sb
    .from("project_members")
    .select("project_role")
    .eq("project_id", projectId)
    .eq("user_id", res.userId)
    .maybeSingle();
  if (!data || data.project_role !== "member") {
    return { ok: false, error: "Not authorized" };
  }
  return res;
}

/** Require any read access to a project (admin, member, or viewer). */
export async function requireProjectReader(
  projectId: string,
): Promise<GuardResult> {
  const res = await requireAuth();
  if (!res.ok) return res;
  if (res.role === "admin") return res;

  const sb = await createClient();
  const { data } = await sb
    .from("project_members")
    .select("project_role")
    .eq("project_id", projectId)
    .eq("user_id", res.userId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Not authorized" };
  return res;
}
