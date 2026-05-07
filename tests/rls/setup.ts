import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createTestUser(role: 'admin' | 'staff' | 'client', email: string) {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'TestPass!23',
    email_confirm: true,
  });
  if (error && !error.message.toLowerCase().includes('already')) throw error;

  let userId = data?.user?.id;
  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers();
    userId = list.users.find((u) => u.email === email)!.id;
  }

  await admin.from('profiles').upsert({
    user_id: userId,
    email,
    full_name: email,
    role,
  }, { onConflict: 'user_id' });

  return userId!;
}

export async function clientAs(email: string): Promise<SupabaseClient<Database>> {
  const sb = createClient<Database>(URL, ANON);
  const { error } = await sb.auth.signInWithPassword({ email, password: 'TestPass!23' });
  if (error) throw error;
  return sb;
}
