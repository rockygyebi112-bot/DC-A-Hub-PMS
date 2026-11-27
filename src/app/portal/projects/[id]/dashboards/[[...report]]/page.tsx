import Link from "next/link";
import { forbidden, notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/ui/page-header";
import { CopyDashboardLink } from "@/components/portal/copy-dashboard-link";
import { PortalProjectTabs } from "@/components/portal/project-tabs";
import { getPortalProjectDetail } from "@/lib/portal/queries";
import { getEvaluationForProject } from "@/lib/evaluations/queries";
import { getUnescoDashboardAccess } from "@/lib/unesco-dashboards/access";
import {
  isUnescoDashboardSlug, unescoDashboardPath, unescoDashboards,
} from "@/lib/unesco-dashboards/routes";

export const dynamic = "force-dynamic";

export default async function UnescoDashboardPage({
  params,
}: {
  params: Promise<{ id: string; report?: string[] }>;
}) {
  const { id, report = [] } = await params;
  const [slug] = report;
  if (report.length > 1 || (slug !== undefined && !isUnescoDashboardSlug(slug))) notFound();

  const access = await getUnescoDashboardAccess(id);
  if (access.status === "missing") notFound();
  if (access.status === "signed-out") {
    redirect(`/login?next=${encodeURIComponent(unescoDashboardPath(id, slug))}`);
  }
  if (access.status === "denied" || (slug && !access.allowed.includes(slug))) forbidden();

  const [detail, evaluation] = await Promise.all([
    getPortalProjectDetail(id),
    getEvaluationForProject(id),
  ]);
  if (!detail) forbidden();

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader title={detail.project.name} />
      <PortalProjectTabs projectId={id} hasEvaluation={!!evaluation} hasDashboards />
      {slug ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">{unescoDashboards[slug].title}</h2>
            <CopyDashboardLink path={unescoDashboardPath(id, slug)} />
          </div>
          <iframe
            className="h-[80dvh] min-h-[24rem] w-full rounded border bg-white"
            title={unescoDashboards[slug].title}
            src={`/api/projects/${id}/dashboards/${slug}/content`}
            sandbox="allow-scripts"
          />
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold">Dashboards</h2>
          {access.allowed.length === 0 && <p>No dashboards are available to your account.</p>}
          <ul className="space-y-2">
            {access.allowed.map((item) => (
              <li key={item} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                <Link className="font-medium text-primary hover:underline" href={unescoDashboardPath(id, item)}>
                  {unescoDashboards[item].title}
                </Link>
                <CopyDashboardLink path={unescoDashboardPath(id, item)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
