/**
 * One-off: delete eval/dummy data from the internal workspace, confirmed
 * by the operator.
 *   - every internal_tasks row (all 46 are repeated eval fixtures)
 *   - the 6 "IW Temp <timestamp>" internal_areas
 *
 * Keeps the 5 real seeded areas (Business Development, HR & Recruitment,
 * Internal Training, Finance & Admin, Operations).
 *
 * internal_task_assignees cascade on task delete; internal_tasks.area_id
 * is ON DELETE RESTRICT, so tasks are removed before the temp areas.
 *
 * Usage: npx tsx scripts/delete-internal-dummy.ts
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

const KEEP_AREAS = [
  "Business Development",
  "HR & Recruitment",
  "Internal Training",
  "Finance & Admin",
  "Operations",
];

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. All internal tasks (assignees cascade).
  const { data: tasks } = await admin.from("internal_tasks").select("id");
  const taskIds = (tasks ?? []).map((t) => t.id);
  if (taskIds.length) {
    const { error } = await admin
      .from("internal_tasks")
      .delete()
      .in("id", taskIds);
    if (error) console.error(`x delete tasks: ${error.message}`);
    else console.log(`deleted ${taskIds.length} internal task(s)`);
  } else {
    console.log("no internal tasks to delete");
  }

  // 2. The IW Temp areas — everything not in the keep-list.
  const { data: tempAreas } = await admin
    .from("internal_areas")
    .select("id, name")
    .not("name", "in", `(${KEEP_AREAS.map((n) => `"${n}"`).join(",")})`);
  for (const a of tempAreas ?? [])
    console.log(`temp area to delete: ${a.name} (${a.id})`);
  const tempIds = (tempAreas ?? []).map((a) => a.id);
  if (tempIds.length) {
    const { error } = await admin
      .from("internal_areas")
      .delete()
      .in("id", tempIds);
    if (error) console.error(`x delete temp areas: ${error.message}`);
    else console.log(`deleted ${tempIds.length} temp area(s)`);
  }

  // 3. Verify.
  const { data: areas } = await admin.from("internal_areas").select("name");
  const { count } = await admin
    .from("internal_tasks")
    .select("*", { count: "exact", head: true });
  console.log(`\nRemaining internal areas (${areas?.length ?? 0}):`);
  for (const a of areas ?? []) console.log(`  - ${a.name}`);
  console.log(`Remaining internal tasks: ${count ?? 0}`);
}

main();
