import { config } from 'dotenv';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/types';

config({ path: path.resolve(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL!;
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Admin';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD!;

if (!SUPABASE_URL || !SERVICE_ROLE || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    'Missing one of: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD',
  );
  process.exit(1);
}

const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  let userId: string;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });

  if (createErr && !createErr.message.toLowerCase().includes('already')) {
    console.error('createUser failed:', createErr);
    process.exit(1);
  }

  if (created?.user) {
    userId = created.user.id;
  } else {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) {
      console.error('listUsers failed:', listErr);
      process.exit(1);
    }
    const found = list.users.find((u) => u.email === ADMIN_EMAIL);
    if (!found) {
      console.error('User not found after create attempt.');
      process.exit(1);
    }
    userId = found.id;
  }

  const { error: upsertErr } = await admin.from('profiles').upsert(
    {
      user_id: userId,
      email: ADMIN_EMAIL,
      full_name: ADMIN_NAME,
      role: 'admin',
    },
    { onConflict: 'user_id' },
  );

  if (upsertErr) {
    console.error('profile upsert failed:', upsertErr);
    process.exit(1);
  }

  console.log(`Seeded admin: ${ADMIN_EMAIL} (${userId})`);
}

main();
