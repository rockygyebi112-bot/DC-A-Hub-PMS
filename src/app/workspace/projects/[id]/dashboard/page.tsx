import { notFound, redirect } from 'next/navigation';

import { PageHeader } from '@/components/admin/ui/page-header';
import { ProjectIcon } from '@/components/ui/project-icon';
import { DashboardView } from '@/components/evaluations/dashboard-view';
import { ProjectDashboardTabs } from '@/components/evaluations/project-dashboard-tabs';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { getEvaluation, getEvaluationForProject } from '@/lib/evaluations/queries';
import { getWorkspaceProject } from '@/lib/workspace/queries';

export const dynamic = 'force-dynamic';

export default async function StaffDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: projectId } = await params;
  const sp = await searchParams;

  // These three reads are mutually independent — fan them out.
  const [profile, project, evMin] = await Promise.all([
    getCurrentProfile(),
    getWorkspaceProject(projectId),
    getEvaluationForProject(projectId),
  ]);

  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    redirect('/');
  }
  if (!project) notFound();
  if (!evMin) notFound();

  // Depends on evMin.id, so it runs after the fan-out.
  const ev = await getEvaluation(evMin.id);
  if (!ev) notFound();

  const hh = (ev.instruments ?? []).find(
    (i: { kind: string }) => i.kind === 'hh',
  );

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <ProjectIcon name={project.name} seed={project.id} />
            <span>{project.name}</span>
          </span>
        }
        subtitle={`Data Collection · ${project.client?.name ?? 'Client'}`}
        backFallbackHref={`/workspace/projects/${projectId}`}
      />
      <div className="mb-6">
        <ProjectDashboardTabs projectId={projectId} />
      </div>
      {hh ? (
        <DashboardView
          projectId={projectId}
          evaluationId={ev.id}
          instrumentId={hh.id}
          targetN={ev.collection_target_n}
          defaultMode={
            (ev.dashboard_default_mode ?? 'auto') as
              | 'auto'
              | 'progress'
              | 'findings'
          }
          searchParams={sp}
          approvedOnly={false}
          showStaffControls
        />
      ) : (
        <p className="p-6 text-sm text-muted-foreground">
          No instrument configured.
        </p>
      )}
    </>
  );
}
