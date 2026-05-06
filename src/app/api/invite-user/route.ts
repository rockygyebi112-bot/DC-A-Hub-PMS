import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Verify caller is admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*, role:roles(*)")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role?.name !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, roleId } = await request.json();

  if (!email || !roleId) {
    return NextResponse.json(
      { error: "Email and role are required" },
      { status: 400 }
    );
  }

  // Use admin client to create user
  const admin = createAdminClient();
  const { data: invitedUser, error } = await admin.auth.admin.inviteUserByEmail(
    email
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Set the user's role and status to active
  if (invitedUser.user) {
    await admin.from("user_profiles").upsert({
      id: invitedUser.user.id,
      email,
      role_id: roleId,
      status: "active",
      updated_at: new Date().toISOString(),
    });

    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "user_invited",
      details: { invited_email: email, role_id: roleId },
    });
  }

  return NextResponse.json({ success: true });
}
