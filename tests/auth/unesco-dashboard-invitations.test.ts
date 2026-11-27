import { afterEach, describe, expect, it, vi } from "vitest";
import { createDashboardShareLink, inviteDashboardGuest, revokeDashboardGuest } from "@/lib/unesco-dashboards/guest-link-actions";
import { getGuestDashboardProject, hashGuestLink } from "@/lib/unesco-dashboards/guest-links";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  send: vi.fn(),
  from: vi.fn(),
  cookie: vi.fn(),
}));
vi.mock("@/lib/unesco-dashboards/access", () => ({
  getUnescoDashboardAccess: mocks.access,
  isUnescoProject: (id: string) => id === process.env.UNESCO_PROJECT_ID,
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: mocks.send }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ from: mocks.from }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }) }));

const project = "b15432aa-74ad-4937-be41-c746fc72ab9c";
const invitation = "ebf23f23-084f-45a1-8f07-f206718dbdf8";
const email = "recipient@example.org";

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("UNESCO email invitations", () => {
  it("rejects invite and revoke for ordinary project viewers", async () => {
    mocks.access.mockResolvedValue({ status: "member", projectRole: "viewer" });
    expect(await inviteDashboardGuest(project, "participant-trajectory", email)).toHaveProperty("error");
    expect(await revokeDashboardGuest(project, "participant-trajectory", invitation)).toHaveProperty("error");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("sends the invitation to the address selected by a project manager", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://pms.example");
    mocks.access.mockResolvedValue({ status: "member", projectRole: "manager", userId: "manager" });
    const data = { id: invitation, email, expires_at: "2027-01-01T00:00:00Z" };
    const upsert = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data }) }) });
    mocks.from.mockReturnValue({ upsert });
    mocks.send.mockResolvedValue({ ok: true });

    expect(await inviteDashboardGuest(project, "participant-trajectory", " Recipient@Example.org ")).toEqual({ invitation: data, sent: true });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ project_id: project, dashboard_slug: "participant-trajectory", email, session_hash: null }), expect.anything());
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      to: email,
      subject: expect.stringContaining("Participant Trajectory"),
      text: expect.stringContaining(`https://pms.example/share/dashboards/${invitation}?verify=`),
    }));
    const message = mocks.send.mock.calls[0]?.[0]?.text as string;
    const token = new URL(message.split("\n").at(-1)!).searchParams.get("verify");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      challenge_hash: hashGuestLink(token!),
      challenge_expires_at: expect.any(String),
    }), expect.anything());
  });

  it("creates a manager-only share link without an email or delivery", async () => {
    mocks.access.mockResolvedValue({ status: "member", projectRole: "viewer" });
    expect(await createDashboardShareLink(project, "participant-trajectory")).toHaveProperty("error");
    expect(mocks.from).not.toHaveBeenCalled();

    mocks.access.mockResolvedValue({ status: "member", projectRole: "manager", userId: "manager" });
    const link = { id: invitation, email: null, expires_at: "2027-01-01T00:00:00Z" };
    const insert = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: link }) }) });
    mocks.from.mockReturnValue({ insert });
    expect(await createDashboardShareLink(project, "participant-trajectory")).toEqual({ link });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      project_id: project, dashboard_slug: "participant-trajectory", email: null,
    }));
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("serves a live share link without cookies and rejects it after revocation", async () => {
    vi.stubEnv("UNESCO_PROJECT_ID", project);
    const lookup = vi.fn().mockResolvedValue({ data: {
      id: invitation, project_id: project, dashboard_slug: "participant-trajectory",
      email: null, session_hash: null,
    } });
    mocks.from.mockReturnValue({ select: () => ({
      eq: () => ({ gt: () => ({ maybeSingle: lookup }) }),
    }) });
    expect(await getGuestDashboardProject(invitation, "participant-trajectory")).toBe(project);
    expect(await getGuestDashboardProject(invitation, "youth-in-work")).toBeNull();
    expect(mocks.cookie).not.toHaveBeenCalled();
    lookup.mockResolvedValue({ data: null });
    expect(await getGuestDashboardProject(invitation, "participant-trajectory")).toBeNull();
  });

  it("requires the verified browser cookie and denies a revoked invitation", async () => {
    vi.stubEnv("UNESCO_PROJECT_ID", project);
    const session = "a".repeat(43);
    const lookup = vi.fn().mockResolvedValue({ data: { id: invitation, email, project_id: project, dashboard_slug: "participant-trajectory", session_hash: hashGuestLink(session) } });
    const eq = vi.fn().mockReturnValue({ gt: () => ({ maybeSingle: lookup }) });
    mocks.from.mockReturnValue({ select: () => ({ eq }) });

    expect(await getGuestDashboardProject(invitation, "participant-trajectory")).toBeNull();
    mocks.cookie.mockReturnValue({ value: session });
    expect(await getGuestDashboardProject(invitation, "participant-trajectory")).toBe(project);
    expect(eq).toHaveBeenCalledWith("id", invitation);
    expect(await getGuestDashboardProject(invitation, "youth-in-work")).toBeNull();

    lookup.mockResolvedValue({ data: null });
    expect(await getGuestDashboardProject(invitation, "participant-trajectory")).toBeNull();
  });
});
