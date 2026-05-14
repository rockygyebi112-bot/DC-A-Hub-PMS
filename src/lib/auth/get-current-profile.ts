import { getSessionUser } from './session';
import type { AppRole } from './require-role';

export type CurrentProfile = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  avatarUrl: string | null;
};

/**
 * Thin adapter over `getSessionUser()`. Kept for call-site compatibility —
 * the shared cache entry now lives in `./session`, so this is a one-line
 * projection with no extra Supabase round-trips.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const user = await getSessionUser();
  // Inactive users keep their cookie until the JWT refreshes (~1h), so without
  // an explicit isActive gate here the shell of /admin, /workspace, or /portal
  // is reachable for that window even though every individual data read fails
  // via RLS. Treat inactive as not-signed-in so the root redirect sends them
  // back to /login.
  if (!user || !user.isActive) return null;
  return {
    userId: user.userId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}
