import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "./require-role";

/**
 * Single source of truth for "who is the caller?" within a server render or
 * server action. Bundles the `auth.getUser()` call and the `profiles` row
 * lookup into one cache entry so layout + page + guards + nested helpers
 * cooperate on a single Supabase round-trip per request.
 *
 * Returning `null` means "not authenticated or no usable profile" — the
 * shape stays consistent so call sites can do a single null check.
 */
export type SessionUser = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  avatarUrl: string | null;
  isActive: boolean;
};

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await sb
    .from("profiles")
    .select("user_id, email, full_name, role, avatar_url, is_active")
    .eq("user_id", user.id)
    .single();
  if (error || !profile) return null;

  return {
    userId: profile.user_id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as AppRole,
    avatarUrl: profile.avatar_url ?? null,
    isActive: profile.is_active !== false,
  };
});
