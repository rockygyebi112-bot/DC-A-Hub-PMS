import "server-only";

import { createClient } from "@/lib/supabase/server";
import { throwIfError } from "@/lib/supabase/errors";
import type { AppRole } from "@/lib/auth/require-role";

export type AccountSummary = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  avatarUrl: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  pendingEmail: string | null;
};

/**
 * Loads everything the /account page needs about the currently signed-in
 * user. Returns null if there is no session.
 */
export async function getMyAccount(): Promise<AccountSummary | null> {
  const sb = await createClient();
  const { data: userData } = await sb.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  const { data: profile, error } = await sb
    .from("profiles")
    .select("user_id, email, full_name, role, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();
  throwIfError(error);
  if (!profile) return null;

  // When a user has requested an email change, supabase puts the new address
  // in user.new_email until the confirmation link is clicked.
  const pendingEmail =
    "new_email" in user && typeof user.new_email === "string" && user.new_email
      ? user.new_email
      : null;

  return {
    userId: profile.user_id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as AppRole,
    avatarUrl: profile.avatar_url ?? null,
    createdAt: user.created_at ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    pendingEmail,
  };
}
