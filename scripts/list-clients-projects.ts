/**
 * Read-only: list every client and project so test/eval fixtures can be
 * spotted before any deletion. Usage: npx tsx scripts/list-clients-projects.ts
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
  const { data: clients } = await admin
    .from("clients")
    .select("id, name, contact_email, created_at")
    .order("created_at");
  const { data: projects } = await admin
    .from("projects")
    .select("id, name, code, client_id, status, created_at")
    .order("created_at");

  console.log(`\n=== CLIENTS (${clients?.length ?? 0}) ===`);
  for (const c of clients ?? [])
    console.log(`  ${c.name}  |  ${c.contact_email ?? "-"}  |  ${c.id}`);

  console.log(`\n=== PROJECTS (${projects?.length ?? 0}) ===`);
  for (const p of projects ?? [])
    console.log(`  ${p.name}  |  ${p.code}  |  status=${p.status}  |  ${p.id}`);
}

main();
