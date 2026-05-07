import { createClient } from '@/lib/supabase/server';
import type { AppRole } from './require-role';

export type CurrentProfile = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_id, email, full_name, role')
    .eq('user_id', user.id)
    .single();

  if (error || !profile) return null;

  return {
    userId: profile.user_id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as AppRole,
  };
}
