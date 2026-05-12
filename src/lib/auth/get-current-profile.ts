import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { AppRole } from './require-role';

export type CurrentProfile = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  avatarUrl: string | null;
};

// Wrapped in React `cache` so layout + page + nested helpers all share a
// single auth.getUser() + profiles fetch per request. Without this every
// call site adds two Supabase round-trips to the critical path.
export const getCurrentProfile = cache(
  async (): Promise<CurrentProfile | null> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, role, avatar_url')
      .eq('user_id', user.id)
      .single();

    if (error || !profile) return null;

    return {
      userId: profile.user_id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role as AppRole,
      avatarUrl: profile.avatar_url ?? null,
    };
  },
);
