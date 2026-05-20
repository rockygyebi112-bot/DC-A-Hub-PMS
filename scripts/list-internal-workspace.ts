/**
 * Read-only: list internal-workspace areas and tasks to spot dummy data.
 * Usage: npx tsx scripts/list-internal-workspace.ts
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

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: areas } = await admin
    .from("internal_areas")
    .select("id, name, created_at")
    .order("created_at");
  const { data: tasks } = await admin
    .from("internal_tasks")
    .select("id, title, status, area_id, created_at")
    .order("created_at");

  console.log(`\n=== INTERNAL AREAS (${areas?.length ?? 0}) ===`);
  for (const a of areas ?? [])
    console.log(`  ${a.name}  |  ${a.id}`);

  console.log(`\n=== INTERNAL TASKS (${tasks?.length ?? 0}) ===`);
  for (const t of tasks ?? [])
    console.log(`  ${t.title}  |  status=${t.status}  |  ${t.id}`);
}

main();
