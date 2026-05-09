/**
 * Reset (or set) a Supabase auth user's password using the service-role key.
 *
 * Usage:
 *   npx tsx scripts/reset-password.ts --email you@example.com --password "NewPass123!"
 *
 * Optional flags:
 *   --create        create the user if they don't exist
 *   --role admin    upsert the public.profiles row with this role (admin|staff|client)
 *   --name "Name"   full name to store on the profile (when creating / upserting)
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import { config } from "dotenv";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/types";

config({ path: path.resolve(__dirname, "..", ".env.local") });

function getArg(name: string): string | undefined {
  const flag = `--${name}`;
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  const val = process.argv[idx + 1];
  if (!val || val.startsWith("--")) return "";
  return val;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = getArg("email");
const password = getArg("password");
const create = process.argv.includes("--create");
const role = (getArg("role") ?? "admin") as "admin" | "staff" | "client";
const fullName = getArg("name") ?? "Admin";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}
if (!email || !password) {
  console.error(
    'Usage: npx tsx scripts/reset-password.ts --email you@example.com --password "NewPass123!" [--create] [--role admin] [--name "Full Name"]',
  );
  process.exit(1);
}

const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(target: string) {
  // listUsers paginates 50 per page by default; iterate until found.
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
    if (page > 50) return null; // safety bail
  }
}

async function main() {
  let userId: string;
  const existing = await findUserByEmail(email!);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) {
      console.error("updateUserById failed:", error);
      process.exit(1);
    }
    userId = existing.id;
    console.log(`Password reset for existing user: ${email} (${userId})`);
  } else {
    if (!create) {
      console.error(
        `User ${email} not found. Pass --create to create them.`,
      );
      process.exit(1);
    }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      console.error("createUser failed:", error);
      process.exit(1);
    }
    userId = data.user.id;
    console.log(`Created user: ${email} (${userId})`);
  }

  // Ensure public.profiles row exists with the right role.
  const { error: upsertErr } = await admin.from("profiles").upsert(
    {
      user_id: userId,
      email: email!,
      full_name: fullName,
      role,
    },
    { onConflict: "user_id" },
  );
  if (upsertErr) {
    console.error("profile upsert failed:", upsertErr);
    process.exit(1);
  }
  console.log(`Profile ensured (role=${role}).`);
}

main();
