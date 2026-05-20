/**
 * One-off: delete eval/test fixtures confirmed by the operator.
 *   - Client "Org RLS Eval"  a4c48160-22cc-4610-afe8-d20b15f6b693
 *   - Client "Org RLS Eval"  3e2c7b7b-f107-423d-9b86-26639266c280
 *   - Project "Eval Proj"    4da8e5cc-9144-4065-b3fa-7ce534b46e39
 *
 * projects.client_id is ON DELETE RESTRICT, so projects belonging to the
 * eval clients are removed first; project delete cascades phases /
 * activities / proofs / memberships / activity_log.
 *
 * Usage: npx tsx scripts/delete-eval-fixtures.ts
 */
import { config } from "dotenv";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: path.resolve(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const CLIENT_IDS = [
  "a4c48160-22cc-4610-afe8-d20b15f6b693",
  "3e2c7b7b-f107-423d-9b86-26639266c280",
];
const PROJECT_IDS = ["4da8e5cc-9144-4065-b3fa-7ce534b46e39"];

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Projects owned by the eval clients (clears the FK RESTRICT).
  const { data: ownedProjects } = await admin
    .from("projects")
    .select("id, name")
    .in("client_id", CLIENT_IDS);
  for (const p of ownedProjects ?? [])
    console.log(`project under eval client: ${p.name} (${p.id})`);

  const { error: ownedErr } = await admin
    .from("projects")
    .delete()
    .in("client_id", CLIENT_IDS);
  if (ownedErr) console.error(`x delete owned projects: ${ownedErr.message}`);

  // 2. The explicitly-named Eval Proj project (in case it sits under a real client).
  const { error: projErr } = await admin
    .from("projects")
    .delete()
    .in("id", PROJECT_IDS);
  if (projErr) console.error(`x delete Eval Proj: ${projErr.message}`);
  else console.log(`deleted project(s): ${PROJECT_IDS.join(", ")}`);

  // 3. The eval clients themselves.
  const { error: clientErr } = await admin
    .from("clients")
    .delete()
    .in("id", CLIENT_IDS);
  if (clientErr) console.error(`x delete eval clients: ${clientErr.message}`);
  else console.log(`deleted client(s): ${CLIENT_IDS.join(", ")}`);

  // 4. Verify.
  const { data: clients } = await admin.from("clients").select("name");
  const { data: projects } = await admin.from("projects").select("name");
  console.log(`\nRemaining clients (${clients?.length ?? 0}):`);
  for (const c of clients ?? []) console.log(`  - ${c.name}`);
  console.log(`Remaining projects (${projects?.length ?? 0}):`);
  for (const p of projects ?? []) console.log(`  - ${p.name}`);
}

main();
