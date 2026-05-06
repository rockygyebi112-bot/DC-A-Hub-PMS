import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function routeDisabled() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

// Disabled by default. To use it intentionally, set both:
// ENABLE_BOOTSTRAP_ADMIN=true and BOOTSTRAP_ADMIN_SECRET=<secret>
export async function POST(request: Request) {
  if (
    process.env.ENABLE_BOOTSTRAP_ADMIN !== "true" ||
    !process.env.BOOTSTRAP_ADMIN_SECRET
  ) {
    return routeDisabled();
  }

  if (
    request.headers.get("x-bootstrap-admin-secret") !==
    process.env.BOOTSTRAP_ADMIN_SECRET
  ) {
    return routeDisabled();
  }

  const supabase = createAdminClient();

  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "Admin")
    .single();

  if (!role) {
    return NextResponse.json(
      { error: "Admin role not found. Run migrations first." },
      { status: 500 },
    );
  }

  const { data: existingAdmin } = await supabase
    .from("user_profiles")
    .select("id, role:roles(name)")
    .eq("status", "active");

  if (
    existingAdmin?.some(
      (profile) =>
        (profile as { role?: { name?: string } | null }).role?.name === "Admin",
    )
  ) {
    return NextResponse.json(
      { error: "An active admin already exists." },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, email, status, role_id")
    .order("created_at", { ascending: true });

  if (!profiles || profiles.length === 0) {
    return NextResponse.json(
      { error: "No user profiles found. Sign up first." },
      { status: 404 },
    );
  }

  const targetUser =
    profiles.find((profile) => profile.email === body.email) ?? profiles[0];

  const { error } = await supabase
    .from("user_profiles")
    .update({ status: "active", role_id: role.id })
    .eq("id", targetUser.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `User ${targetUser.email} promoted to Admin`,
  });
}
