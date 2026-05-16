/**
 * Delete leftover test-fixture data from Supabase:
 *   - auth users whose email ends in @example.com (cascades profiles + memberships)
 *   - test client orgs by exact name and known patterns (cascades projects + memberships)
 *
 * Tests in tests/integration and tests/rls create these and never cleaned up.
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

// HARD STOP for production. This script matches `@example.com` and assorted
// test-fixture names — running it with prod credentials would delete any real
// user/client whose name happens to fit those patterns. The combination of
// service-role key + bulk delete + pattern match is too dangerous to ship
// without a defence-in-depth interlock.
//
// To run against prod (don't), the operator must explicitly set
// CONFIRM_TEST_CLEANUP=yes AND ensure NODE_ENV is not "production".
if (APPLY) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "Refusing to --apply: NODE_ENV=production. This script is for dev/test fixtures only.",
    );
    process.exit(1);
  }
  if (process.env.CONFIRM_TEST_CLEANUP !== "yes") {
    console.error(
      "Refusing to --apply: set CONFIRM_TEST_CLEANUP=yes to acknowledge that the\n" +
        "configured SUPABASE_URL points at a non-production project. This script\n" +
        "matches @example.com and bulk-deletes via the service-role key.",
    );
    process.exit(1);
  }
  // Bail if the URL looks like an obvious production host. Project owners can
  // extend this denylist if they keep their prod ref in env.
  const PROD_HOST_DENYLIST = (process.env.PROD_SUPABASE_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (PROD_HOST_DENYLIST.length) {
    try {
      const host = new URL(SUPABASE_URL).host;
      if (PROD_HOST_DENYLIST.some((p) => host === p || host.endsWith(`.${p}`))) {
        console.error(
          `Refusing to --apply: SUPABASE_URL host '${host}' matches PROD_SUPABASE_HOSTS denylist.`,
        );
        process.exit(1);
      }
    } catch {
      console.error("SUPABASE_URL is not a valid URL");
      process.exit(1);
    }
  }
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL_SUFFIX = "@example.com";
const TEST_CLIENT_NAMES = [
  "Org A (rlstest)",
  "Org B (rlstest)",
  "ArchiveRLSClient",
  "Action Test Client",
];
const TEST_CLIENT_NAME_PATTERNS = ["PM-Test %", "ProjActions Client %"];

async function findUsers(): Promise<{ id: string; email: string }[]> {
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
  return matches;
}

async function findClients(): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];

  if (TEST_CLIENT_NAMES.length) {
    const { data } = await admin
      .from("clients")
      .select("id, name")
      .in("name", TEST_CLIENT_NAMES);
    for (const c of data ?? []) out.push({ id: c.id, name: c.name });
  }
  for (const pattern of TEST_CLIENT_NAME_PATTERNS) {
    const { data } = await admin
      .from("clients")
      .select("id, name")
      .like("name", pattern);
    for (const c of data ?? []) out.push({ id: c.id, name: c.name });
  }

  // de-dupe by id
  const seen = new Set<string>();
  return out.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

async function main() {
  const users = await findUsers();
  const clients = await findClients();

  if (users.length === 0 && clients.length === 0) {
    console.log("No test users or clients found.");
    return;
  }

  if (users.length) {
    console.log(`Test users (${users.length}):`);
    for (const m of users) console.log(`  - ${m.email}  (${m.id})`);
  }
  if (clients.length) {
    console.log(`Test clients (${clients.length}):`);
    for (const c of clients) console.log(`  - ${c.name}  (${c.id})`);
  }

  if (!APPLY) {
    console.log("\nDry-run. Re-run with --apply to delete the above.");
    return;
  }

  // projects.client_id is ON DELETE RESTRICT, so wipe projects of test
  // clients first (cascades phases/activities/proofs/memberships), then the
  // clients themselves.
  if (clients.length) {
    const clientIds = clients.map((c) => c.id);
    const { error: projDelErr } = await admin
      .from("projects")
      .delete()
      .in("client_id", clientIds);
    if (projDelErr) {
      console.error(`  x deleting projects: ${projDelErr.message}`);
    }
  }

  let clientsDeleted = 0;
  for (const c of clients) {
    const { error } = await admin.from("clients").delete().eq("id", c.id);
    if (error) console.error(`  x client ${c.name}: ${error.message}`);
    else clientsDeleted += 1;
  }

  let usersDeleted = 0;
  let usersFailed = 0;
  for (const m of users) {
    const { error } = await admin.auth.admin.deleteUser(m.id);
    if (error) {
      usersFailed += 1;
      console.error(`  x user ${m.email}: ${error.message}`);
    } else {
      usersDeleted += 1;
    }
  }

  console.log(
    `\nDeleted ${clientsDeleted} client${clientsDeleted === 1 ? "" : "s"} and ${usersDeleted} user${usersDeleted === 1 ? "" : "s"}.`,
  );
  if (usersFailed > 0) console.log(`User failures: ${usersFailed}.`);
}

main();
