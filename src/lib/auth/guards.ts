import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "./session";
import type { AppRole } from "./require-role";

export type GuardResult =
  | { ok: true; userId: string; role: AppRole }
  | { ok: false; error: string };

/**
 * The caller's project_role for a project, or null if they have no membership.
 * Wrapped in React `cache()` so layout + page + guard + action share a single
 * round-trip per request instead of each re-querying project_members.
 */
const getProjectRole = cache(
  async (userId: string, projectId: string): Promise<string | null> => {
    const sb = await createClient();
    const { data } = await sb
      .from("project_members")
      .select("project_role")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    return data?.project_role ?? null;
  },
);

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

/**
 * Require write access to a specific project. Admins always pass; non-admins
 * must have a project_members row with project_role = 'manager' or 'member'.
 * Viewers (clients) are intentionally rejected here.
 */
export async function requireProjectWriter(
  projectId: string,
): Promise<GuardResult> {
  const res = await requireAuth();
  if (!res.ok) return res;
  if (res.role === "admin") return res;

  const projectRole = await getProjectRole(res.userId, projectId);
  if (projectRole !== "member" && projectRole !== "manager") {
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

  const projectRole = await getProjectRole(res.userId, projectId);
  if (!projectRole) return { ok: false, error: "Not authorized" };
  return res;
}
