import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getUnescoDashboardAccess } from "@/lib/unesco-dashboards/access";
import { isUnescoDashboardSlug, unescoDashboards } from "@/lib/unesco-dashboards/routes";

export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; slug: string }> },
) {
  const { id, slug } = await params;
  if (!isUnescoDashboardSlug(slug)) return new Response(null, { status: 404, headers: privateHeaders });

  const access = await getUnescoDashboardAccess(id);
  if (access.status === "missing") return new Response(null, { status: 404, headers: privateHeaders });
  if (access.status === "signed-out") return new Response(null, { status: 401, headers: privateHeaders });
  if (access.status !== "member" || !access.allowed.includes(slug)) {
    return new Response(null, { status: 403, headers: privateHeaders });
  }

  const html = await readFile(
    join(process.cwd(), "private", "unesco-dashboards", unescoDashboards[slug].filename),
    "utf8",
  );
  return new Response(html, {
    headers: { ...privateHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}
