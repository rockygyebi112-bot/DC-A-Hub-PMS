import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient, cleanupTestData, createTestUser } from "../rls/setup";

describe("admin actions (DB layer)", () => {
  const admin = adminClient();

  beforeAll(async () => {
    await createTestUser("admin", "admin-actions-test@example.com");
  }, 60_000);

  afterAll(async () => {
    await cleanupTestData();
  }, 60_000);

  it("create + archive + restore client", async () => {
    const { data: created, error: ce } = await admin
      .from("clients")
      .insert({ name: "Action Test Client" })
      .select("id")
      .single();
    expect(ce).toBeNull();
    const id = created!.id;

    const { error: ae } = await admin
      .from("clients")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    expect(ae).toBeNull();

    const { data: archived } = await admin
      .from("clients")
      .select("archived_at")
      .eq("id", id)
      .single();
    expect(archived?.archived_at).not.toBeNull();

    const { error: re } = await admin
      .from("clients")
      .update({ archived_at: null })
      .eq("id", id);
    expect(re).toBeNull();

    await admin.from("clients").delete().eq("id", id);
  });

  it("create + archive project", async () => {
    const { data: client } = await admin
      .from("clients")
      .insert({ name: `ProjActions Client ${Date.now()}` })
      .select("id")
      .single();

    const { data: proj, error: pe } = await admin
      .from("projects")
      .insert({
        name: "Action Test Project",
        code: `AT-${Date.now()}`,
        client_id: client!.id,
        status: "planning",
      })
      .select("id")
      .single();
    expect(pe).toBeNull();
    const id = proj!.id;

    const { error: ae } = await admin
      .from("projects")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    expect(ae).toBeNull();

    await admin.from("projects").delete().eq("id", id);
    await admin.from("clients").delete().eq("id", client!.id);
  });

  it("create auth user + profile (mirrors invite flow DB writes)", async () => {
    // Note: Supabase rejects auth.admin.inviteUserByEmail for @example.com, so
    // this test exercises the post-invite DB writes (auth user creation + profile
    // upsert with role) rather than the actual email send. The invite call itself
    // is verified by manual smoke test in Task 14.
    const email = `invite-test-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "TestPass!23",
      email_confirm: true,
    });
    expect(error).toBeNull();
    const userId = data!.user!.id;

    const { error: pe } = await admin.from("profiles").upsert(
      {
        user_id: userId,
        email,
        full_name: email,
        role: "staff",
      },
      { onConflict: "user_id" },
    );
    expect(pe).toBeNull();

    const { data: profile } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("user_id", userId)
      .single();
    expect(profile?.role).toBe("staff");
    expect(profile?.is_active).toBe(true);

    await admin.from("profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  });

  it("project_members add + remove", async () => {
    const { data: client } = await admin
      .from("clients")
      .insert({ name: `PM-Test ${Date.now()}` })
      .select("id")
      .single();
    const { data: proj } = await admin
      .from("projects")
      .insert({
        name: "PM-Test",
        code: `PM-${Date.now()}`,
        client_id: client!.id,
      })
      .select("id")
      .single();
    const userId = await createTestUser(
      "staff",
      `pm-test-${Date.now()}@example.com`,
    );

    const { data: row, error: ie } = await admin
      .from("project_members")
      .insert({
        project_id: proj!.id,
        user_id: userId,
        project_role: "member",
      })
      .select("id")
      .single();
    expect(ie).toBeNull();

    const { error: de } = await admin
      .from("project_members")
      .delete()
      .eq("id", row!.id);
    expect(de).toBeNull();

    await admin.from("projects").delete().eq("id", proj!.id);
    await admin.from("clients").delete().eq("id", client!.id);
  });

  it("deactivate user — is_active goes false and ban applied", async () => {
    const email = `deact-${Date.now()}@example.com`;
    const userId = await createTestUser("staff", email);

    const { error: be } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });
    expect(be).toBeNull();

    const { error: ue } = await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("user_id", userId);
    expect(ue).toBeNull();

    const { data: list } = await admin.auth.admin.listUsers();
    const u = list.users.find((x) => x.email === email);
    expect(u?.banned_until).toBeTruthy();

    await admin.from("profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  });
});
