import Link from "next/link";
import { forbidden, notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/ui/page-header";
import { CopyDashboardLink } from "@/components/portal/copy-dashboard-link";
import { DashboardGuestLink } from "@/components/portal/dashboard-guest-link";
import { DashboardViewer } from "@/components/portal/dashboard-viewer";
import { PortalProjectTabs } from "@/components/portal/project-tabs";
import { getPortalProjectDetail } from "@/lib/portal/queries";
import { getEvaluationForProject } from "@/lib/evaluations/queries";
import { createServiceClient } from "@/lib/supabase/server";
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
  const { id: projectKey, report = [] } = await params;
  const id = projectKey === "unesco" ? process.env.UNESCO_PROJECT_ID : projectKey;
  if (!id) notFound();
  const [slug] = report;
  if (report.length > 1 || (slug !== undefined && !isUnescoDashboardSlug(slug))) notFound();

  const access = await getUnescoDashboardAccess(id);
  if (access.status === "missing") notFound();
  if (access.status === "signed-out") {
    redirect(`/login?next=${encodeURIComponent(unescoDashboardPath(slug))}`);
  }
  if (access.status === "denied" || (slug && !access.allowed.includes(slug))) forbidden();

  const [detail, evaluation] = await Promise.all([
    getPortalProjectDetail(id),
    getEvaluationForProject(id),
  ]);
  if (!detail) forbidden();
  const managesInvitations = slug && access.projectRole === "manager";
  const invitations = managesInvitations
    ? await createServiceClient().from("unesco_dashboard_guest_links")
        .select("id, email, expires_at").eq("project_id", id).eq("dashboard_slug", slug)
        .gt("expires_at", new Date().toISOString()).order("email")
    : null;

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader title={detail.project.name} />
      <PortalProjectTabs projectId={id} hasEvaluation={!!evaluation} hasDashboards />
      {slug ? (
        <>
          {managesInvitations && (invitations?.data
            ? <DashboardGuestLink key={slug} projectId={id} slug={slug} invitations={invitations.data} />
            : <p role="status">Guest invitation management is temporarily unavailable.</p>)}
          <DashboardViewer
            title={unescoDashboards[slug].title}
            path={unescoDashboardPath(slug)}
            source={`/api/projects/${id}/dashboards/${slug}/content`}
          />
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold">Dashboards</h2>
          <ul className="space-y-2">
            {access.allowed.map((item) => (
              <li key={item} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                <Link className="font-medium text-primary hover:underline" href={unescoDashboardPath(item)}>
                  {unescoDashboards[item].title}
                </Link>
                <CopyDashboardLink path={unescoDashboardPath(item)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
