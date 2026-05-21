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

/**
 * Delete every test fixture this suite (and siblings) might create:
 *   - auth users whose email ends in @example.com (cascades profiles + memberships)
 *   - the named test clients (cascades their projects + evaluations + memberships)
 *
 * Internal-workspace fixtures are cleaned separately via `deleteInternalAreas`
 * (id-scoped, to avoid races between concurrent test files).
 *
 * Safe to call multiple times. Intended for `afterAll` in integration tests so
 * the production-ish admin Users page doesn't accumulate fake users.
 */
const TEST_EMAIL_SUFFIX = '@example.com';
const TEST_CLIENT_NAMES = [
  'Org A (rlstest)',
  'Org B (rlstest)',
  'ArchiveRLSClient',
  'Action Test Client',
];
const TEST_CLIENT_NAME_PATTERNS = [
  'PM-Test %',
  'ProjActions Client %',
];

export async function cleanupTestData(): Promise<void> {
  const admin = adminClient();

  // projects.client_id is ON DELETE RESTRICT, so collect target client ids,
  // wipe their projects first (cascades phases/activities/proofs/memberships),
  // then delete the clients.
  const targetClientIds: string[] = [];
  if (TEST_CLIENT_NAMES.length) {
    const { data } = await admin
      .from('clients')
      .select('id')
      .in('name', TEST_CLIENT_NAMES);
    for (const c of data ?? []) targetClientIds.push(c.id);
  }
  for (const pattern of TEST_CLIENT_NAME_PATTERNS) {
    const { data } = await admin
      .from('clients')
      .select('id')
      .like('name', pattern);
    for (const c of data ?? []) targetClientIds.push(c.id);
  }
  if (targetClientIds.length) {
    await admin.from('projects').delete().in('client_id', targetClientIds);
    await admin.from('clients').delete().in('id', targetClientIds);
  }

  // Delete auth users with test emails (cascades profiles + memberships).
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const targets = data.users.filter((u) =>
      (u.email ?? '').toLowerCase().endsWith(TEST_EMAIL_SUFFIX),
    );
    for (const u of targets) {
      await admin.auth.admin.deleteUser(u.id);
    }
    if (data.users.length < 200) break;
    page += 1;
    if (page > 50) break;
  }
}

/**
 * Delete specific internal-workspace areas (and their tasks + assignees) by id.
 *
 * Internal-workspace tests create throwaway areas; each test file collects the
 * ids it creates and passes them here from its own `afterAll`. We delete by
 * explicit id rather than a global name-pattern sweep so test files running
 * concurrently (vitest parallelises files) never delete each other's in-flight
 * fixtures.
 *
 * internal_tasks.area_id is ON DELETE RESTRICT, so tasks are deleted first;
 * internal_task_assignees cascade off the task deletion.
 */
export async function deleteInternalAreas(areaIds: string[]): Promise<void> {
  if (!areaIds.length) return;
  const admin = adminClient();
  await admin.from('internal_tasks').delete().in('area_id', areaIds);
  await admin.from('internal_areas').delete().in('id', areaIds);
}
