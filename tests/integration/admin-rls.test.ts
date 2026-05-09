import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminClient, cleanupTestData, createTestUser, clientAs } from "../rls/setup";

const STAFF = "archive-rls-staff@example.com";
let activeProjectId: string;
let archivedProjectId: string;
let clientId: string;

beforeAll(async () => {
  const admin = adminClient();
  const staffId = await createTestUser("staff", STAFF);

  const { data: existingClient } = await admin
    .from("clients")
    .select("id")
    .eq("name", "ArchiveRLSClient")
    .maybeSingle();
  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const { data: c } = await admin
      .from("clients")
      .insert({ name: "ArchiveRLSClient" })
      .select("id")
      .single();
    clientId = c!.id;
  }

  const { data: p1 } = await admin
    .from("projects")
    .upsert(
      {
        name: "Active P",
        code: "ARLS-A",
        client_id: clientId,
        archived_at: null,
      },
      { onConflict: "code" },
    )
    .select("id")
    .single();
  activeProjectId = p1!.id;

  const { data: p2 } = await admin
    .from("projects")
    .upsert(
      {
        name: "Archived P",
        code: "ARLS-Z",
        client_id: clientId,
        archived_at: new Date().toISOString(),
      },
      { onConflict: "code" },
    )
    .select("id")
    .single();
  archivedProjectId = p2!.id;

  await admin.from("project_members").upsert(
    [
      { project_id: activeProjectId, user_id: staffId, project_role: "member" },
      {
        project_id: archivedProjectId,
        user_id: staffId,
        project_role: "member",
      },
    ],
    { onConflict: "project_id,user_id" },
  );
}, 60_000);

afterAll(async () => {
  await cleanupTestData();
}, 60_000);

describe("archive RLS", () => {
  it("staff sees active project but not archived one", async () => {
    const sb = await clientAs(STAFF);
    const { data } = await sb.from("projects").select("id, code");
    const codes = (data ?? []).map((r) => r.code);
    expect(codes).toContain("ARLS-A");
    expect(codes).not.toContain("ARLS-Z");
  });

  it("admin still sees archived project", async () => {
    const admin = adminClient();
    const { data } = await admin
      .from("projects")
      .select("id, code")
      .in("code", ["ARLS-A", "ARLS-Z"]);
    const codes = (data ?? []).map((r) => r.code);
    expect(codes).toContain("ARLS-A");
    expect(codes).toContain("ARLS-Z");
  });
});
