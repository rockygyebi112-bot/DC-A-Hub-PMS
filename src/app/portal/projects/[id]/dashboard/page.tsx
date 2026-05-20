import { notFound } from 'next/navigation';

import { DashboardView } from '@/components/evaluations/dashboard-view';
import { getEvaluation, getEvaluationForProject } from '@/lib/evaluations/queries';
import { getPortalProjectDetail } from '@/lib/portal/queries';

export const dynamic = 'force-dynamic';

export default async function PortalDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: projectId } = await params;
  const sp = await searchParams;

  // The /portal layout already redirects unauthenticated users. RLS scopes
  // project visibility to the user's own client projects, so a missing
  // detail here means the caller is not a member of this project.
  const detail = await getPortalProjectDetail(projectId);
  if (!detail) notFound();

  const evMin = await getEvaluationForProject(projectId);
  if (!evMin) notFound();

  const ev = await getEvaluation(evMin.id);
  if (!ev) notFound();

  const hh = (ev.instruments ?? []).find(
    (i: { kind: string }) => i.kind === 'hh',
  );
  if (!hh) notFound();

  return (
    <DashboardView
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
      approvedOnly
      showStaffControls={false}
    />
  );
}
