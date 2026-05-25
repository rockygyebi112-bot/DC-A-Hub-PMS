import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatusPill } from "@/components/admin/ui/status-pill";
import {
  ActivityStatusCard,
  WorkplanCard,
} from "@/components/portal/project-summary-cards";
import { NeedHelpCard } from "@/components/portal/side-cards";
import { PortalProjectTabs } from "@/components/portal/project-tabs";
import { WorkplanProgressTable } from "@/components/portal/workplan-progress-table";
import { getEvaluationForProject } from "@/lib/evaluations/queries";
import { getPortalProjectDetail, listPortalProjects } from "@/lib/portal/queries";

export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [detail, evaluation, allProjects] = await Promise.all([
    getPortalProjectDetail(id),
    getEvaluationForProject(id),
    listPortalProjects(),
  ]);
  if (!detail) notFound();
  // Single-project clients are redirected from /portal straight into their
  // project, so a back link there would loop them. Only show it when they
  // actually have somewhere to go back to.
  const hasMultipleProjects = allProjects.length > 1;

  const {
    project,
    phases,
    manager,
  } = detail;

  const allActivities = phases.flatMap((p) => p.activities);
  const totalActivities = allActivities.length;
  const inProgressCount = allActivities.filter((a) => a.status === "in_progress").length;
  const doneCount = allActivities.filter((a) => a.status === "done").length;
  const notStartedCount = totalActivities - inProgressCount - doneCount;
  const projectStatus = (project.status ?? "active") as
    | "planning"
    | "active"
    | "paused"
    | "completed";

  const subtitle = [project.code, project.client?.name]
    .filter(Boolean)
    .join(" / ");

  return (
    <div className="space-y-6">
      <PageHeader
        showBack={hasMultipleProjects}
        backFallbackHref="/portal"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span>{project.name}</span>
            <StatusPill status={projectStatus} />
          </span>
        }
        subtitle={subtitle || undefined}
      />

      <PortalProjectTabs
        projectId={project.id}
        hasEvaluation={!!evaluation}
      />

      {/* Summary cards. Manager + timeline + overall progress used to live
          here too; manager is surfaced via NeedHelpCard, and timeline +
          progress already appear in the workplan table headers below. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WorkplanCard
          phases={phases.length}
          activities={totalActivities}
        />
        <ActivityStatusCard
          notStarted={notStartedCount}
          inProgress={inProgressCount}
          done={doneCount}
        />
      </div>

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="space-y-6">
          <div id="workplan">
            <WorkplanProgressTable phases={phases} />
            <div className="mt-3">
              <Link
                href={`/portal/projects/${project.id}/workplan`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View full workplan
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <NeedHelpCard manager={manager} />
        </div>
      </div>
    </div>
  );
}
