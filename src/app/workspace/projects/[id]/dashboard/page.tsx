import { notFound, redirect } from 'next/navigation';

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
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    redirect('/');
  }

  const { id: projectId } = await params;
  const sp = await searchParams;

  const project = await getWorkspaceProject(projectId);
  if (!project) notFound();

  const evMin = await getEvaluationForProject(projectId);
  if (!evMin) notFound();

  const ev = await getEvaluation(evMin.id);
  if (!ev) notFound();

  const hh = (ev.instruments ?? []).find(
    (i: { kind: string }) => i.kind === 'hh',
  );
  return (
    <>
      <div className="space-y-3 px-6 pt-6">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
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
