import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getGuestDashboardProject } from "@/lib/unesco-dashboards/guest-links";
import { getUnescoDashboardAccess } from "@/lib/unesco-dashboards/access";
import { isUnescoDashboardSlug, unescoDashboards } from "@/lib/unesco-dashboards/routes";

export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; slug: string }> },
) {
  const { id, slug } = await params;
  if (!isUnescoDashboardSlug(slug)) return new Response(null, { status: 404, headers: privateHeaders });

  const guest = new URL(request.url).searchParams.get("guest");
  if (guest !== null) {
    if ((await getGuestDashboardProject(guest, slug)) !== id) {
      return new Response(null, { status: 404, headers: privateHeaders });
    }
  } else {
    const access = await getUnescoDashboardAccess(id);
    if (access.status === "missing") return new Response(null, { status: 404, headers: privateHeaders });
    if (access.status === "signed-out") return new Response(null, { status: 401, headers: privateHeaders });
    if (access.status !== "member" || !access.allowed.includes(slug)) {
      return new Response(null, { status: 403, headers: privateHeaders });
    }
  }

  const html = await readFile(
    join(process.cwd(), "private", "unesco-dashboards", unescoDashboards[slug].filename),
    "utf8",
  );
  const report = html
    .replace("total:'Outcome interviews'", "total:'Participant'")
    .replace("chart('How participants linked their work to DARE'", "chart('Youth in Work Category'");
  return new Response(report, {
    headers: { ...privateHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}
