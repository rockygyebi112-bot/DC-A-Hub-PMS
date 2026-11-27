import { describe, it, expect, vi, afterEach } from "vitest";
import { join } from "node:path";
import { GET } from "@/app/api/projects/[id]/dashboards/[slug]/content/route";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  role: vi.fn(),
  rpc: vi.fn(),
  read: vi.fn(),
  guest: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: mocks.session }));
vi.mock("@/lib/unesco-dashboards/guest-links", () => ({ getGuestDashboardProject: mocks.guest }));
vi.mock("@/lib/auth/guards", () => ({ getProjectRole: mocks.role }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.read, default: { readFile: mocks.read } }));

const project = "b15432aa-74ad-4937-be41-c746fc72ab9c";
const other = "ebf23f23-084f-45a1-8f07-f206718dbdf8";

function request(id: string, slug: string) {
  return GET(new Request("https://pms.example"), { params: Promise.resolve({ id, slug }) });
}

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("UNESCO dashboard access", () => {
  it("returns no bytes without a designated project, a session, explicit membership and reporting access", async () => {
    vi.stubEnv("UNESCO_PROJECT_ID", project);
    expect((await request(other, "youth-in-work")).status).toBe(404);
    for (const slug of ["youth-in-work", "participant-trajectory"]) {
      mocks.session.mockResolvedValueOnce(null);
      expect((await request(project, slug)).status).toBe(401);
      mocks.session.mockResolvedValue({ userId: "other-project", role: "admin", isActive: true });
      mocks.role.mockResolvedValue(null);
      const denied = await request(project, slug);
      expect(denied.status).toBe(403);
      expect(await denied.text()).toBe("");
    }
    mocks.role.mockResolvedValue("viewer");
    mocks.rpc.mockResolvedValue({ data: false });
    expect((await request(project, "youth-in-work")).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("serves both snapshots for an active UNESCO project viewer", async () => {
    vi.stubEnv("UNESCO_PROJECT_ID", project);
    mocks.session.mockResolvedValue({ userId: "report-reader", isActive: true });
    mocks.role.mockResolvedValue("viewer");
    mocks.rpc.mockResolvedValue({ data: true });
    mocks.read.mockResolvedValue("<html>summary fixture</html>");
    const summary = await request(project, "youth-in-work");
    expect(summary.status).toBe(200);
    expect(summary.headers.get("cache-control")).toBe("private, no-store");
    expect(await summary.text()).toBe("<html>summary fixture</html>");
    expect(mocks.read).toHaveBeenCalledWith(join(process.cwd(), "private", "unesco-dashboards", "UNESCO_Youth_in_Work.html"), "utf8");
    const restricted = await request(project, "participant-trajectory");
    expect(restricted.status).toBe(200);
    expect(mocks.read).toHaveBeenCalledWith(join(process.cwd(), "private", "unesco-dashboards", "UNESCO_Participant_Trajectory.html"), "utf8");
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });

  it.each(["youth-in-work", "participant-trajectory"])("updates only the requested labels in %s", async (slug) => {
    vi.stubEnv("UNESCO_PROJECT_ID", project);
    mocks.session.mockResolvedValue({ userId: "report-reader", isActive: true });
    mocks.role.mockResolvedValue("viewer");
    mocks.rpc.mockResolvedValue({ data: true });
    mocks.read.mockResolvedValue("total:'Outcome interviews';chart('How participants linked their work to DARE');table(['Outcome interviews'])");
    const report = await request(project, slug);
    expect(await report.text()).toBe("total:'Participant';chart('Youth in Work Category');table(['Outcome interviews'])");
  });

  it("rechecks guest access for each HTML request and scopes it to the invited dashboard", async () => {
    const token = "a".repeat(43);
    const guestRequest = (id: string, slug: string) =>
      GET(new Request(`https://pms.example/content?guest=${token}`), {
        params: Promise.resolve({ id, slug }),
      });

    mocks.guest.mockImplementation(async (_id, slug) => slug === "participant-trajectory" ? project : null);
    mocks.read.mockResolvedValue("<html>summary fixture</html>");
    const report = await guestRequest(project, "participant-trajectory");
    expect(report.status).toBe(200);
    expect(report.headers.get("cache-control")).toBe("private, no-store");
    expect((await guestRequest(project, "youth-in-work")).status).toBe(404);
    expect((await guestRequest(other, "participant-trajectory")).status).toBe(404);
    mocks.guest.mockResolvedValue(null);
    expect((await guestRequest(project, "participant-trajectory")).status).toBe(404);
    expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it.each(["youth-in-work", "participant-trajectory"])("preserves a safe sign-in return to %s", (slug) => {
    for (const identifier of ["unesco", project]) {
      const path = `/portal/projects/${identifier}/dashboards/${slug}`;
      const response = proxy(new NextRequest(`https://pms.example${path}`));
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/login");
      expect(safeRedirectPath(location.searchParams.get("next"))).toBe(path);
    }
    expect(safeRedirectPath("//example.org")).toBe("/");
  });
});
