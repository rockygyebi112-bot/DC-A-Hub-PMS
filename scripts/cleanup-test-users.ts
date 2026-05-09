/**
 * Delete leftover test-fixture users from Supabase auth (and cascade profiles).
 *
 * Tests in tests/integration and tests/rls create auth users with @example.com
 * emails and never clean up. This script removes any auth user whose email
 * ends in @example.com.
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-users.ts            # dry-run, lists matches
 *   npx tsx scripts/cleanup-test-users.ts --apply    # actually delete
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { config } from "dotenv";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: path.resolve(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL_SUFFIX = "@example.com";

async function main() {
  const matches: { id: string; email: string }[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      console.error("listUsers failed:", error);
      process.exit(1);
    }
    for (const u of data.users) {
      const email = u.email?.toLowerCase() ?? "";
      if (email.endsWith(TEST_EMAIL_SUFFIX)) {
        matches.push({ id: u.id, email });
      }
    }
    if (data.users.length < 200) break;
    page += 1;
    if (page > 50) break;
  }

  if (matches.length === 0) {
    console.log(`No users matching *${TEST_EMAIL_SUFFIX} found.`);
    return;
  }

  console.log(
    `Found ${matches.length} test user${matches.length === 1 ? "" : "s"}:`,
  );
  for (const m of matches) console.log(`  - ${m.email}  (${m.id})`);

  if (!APPLY) {
    console.log("\nDry-run. Re-run with --apply to delete these users.");
    return;
  }

  let deleted = 0;
  let failed = 0;
  for (const m of matches) {
    const { error } = await admin.auth.admin.deleteUser(m.id);
    if (error) {
      failed += 1;
      console.error(`  x ${m.email}: ${error.message}`);
    } else {
      deleted += 1;
    }
  }
  console.log(`\nDeleted ${deleted} user${deleted === 1 ? "" : "s"}.`);
  if (failed > 0) console.log(`Failed: ${failed}.`);
}

main();
