import { describe, it, expect } from "vitest";
import {
  clientFormSchema,
  projectFormSchema,
  inviteUserSchema,
  assignMemberSchema,
  inviteClientViewerSchema,
} from "@/lib/admin/schemas";

describe("clientFormSchema", () => {
  it("accepts valid input", () => {
    expect(
      clientFormSchema.safeParse({ name: "Acme", contact_email: "a@b.com" })
        .success,
    ).toBe(true);
  });
  it("requires name", () => {
    expect(clientFormSchema.safeParse({ name: "" }).success).toBe(false);
  });
  it("rejects bad email", () => {
    expect(
      clientFormSchema.safeParse({ name: "Acme", contact_email: "not-email" })
        .success,
    ).toBe(false);
  });
  it("contact_email is optional", () => {
    expect(clientFormSchema.safeParse({ name: "Acme" }).success).toBe(true);
  });
});

describe("projectFormSchema", () => {
  const base = {
    name: "SOCO",
    code: "SOCO",
    client_id: "11111111-1111-4111-8111-111111111111",
    status: "planning" as const,
  };
  it("accepts valid input", () => {
    expect(projectFormSchema.safeParse(base).success).toBe(true);
  });
  it("requires name and code", () => {
    expect(projectFormSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...base, code: "" }).success).toBe(false);
  });
  it("rejects invalid status", () => {
    expect(
      projectFormSchema.safeParse({ ...base, status: "bogus" }).success,
    ).toBe(false);
  });
  it("rejects non-uuid client_id", () => {
    expect(
      projectFormSchema.safeParse({ ...base, client_id: "nope" }).success,
    ).toBe(false);
  });
});

describe("inviteUserSchema", () => {
  it("accepts staff and client roles", () => {
    expect(
      inviteUserSchema.safeParse({ email: "a@b.com", role: "staff" }).success,
    ).toBe(true);
    expect(
      inviteUserSchema.safeParse({ email: "a@b.com", role: "client" }).success,
    ).toBe(true);
  });
  it("rejects admin role (must be created via seed/CLI)", () => {
    expect(
      inviteUserSchema.safeParse({ email: "a@b.com", role: "admin" }).success,
    ).toBe(false);
  });
  it("rejects bad email", () => {
    expect(
      inviteUserSchema.safeParse({ email: "no", role: "staff" }).success,
    ).toBe(false);
  });
});

describe("assignMemberSchema", () => {
  it("accepts a uuid + member role", () => {
    expect(
      assignMemberSchema.safeParse({
        user_id: "11111111-1111-4111-8111-111111111111",
        project_role: "member",
      }).success,
    ).toBe(true);
  });
  it("accepts viewer role", () => {
    expect(
      assignMemberSchema.safeParse({
        user_id: "11111111-1111-4111-8111-111111111111",
        project_role: "viewer",
      }).success,
    ).toBe(true);
  });
});

describe("inviteClientViewerSchema", () => {
  it("accepts email + optional name", () => {
    expect(
      inviteClientViewerSchema.safeParse({
        email: "client@x.com",
        full_name: "Client X",
      }).success,
    ).toBe(true);
    expect(
      inviteClientViewerSchema.safeParse({ email: "client@x.com" }).success,
    ).toBe(true);
  });
});
