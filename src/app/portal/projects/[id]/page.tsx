import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatusPill } from "@/components/admin/ui/status-pill";
import {
  ManagerCard,
  MilestoneCard,
  OverallProgressCard,
  TimelineCard,
  WorkplanCard,
} from "@/components/portal/project-summary-cards";
import {
  AnnouncementsCard,
  KeyDocumentsCard,
  NeedHelpCard,
  RecentActivityCard,
} from "@/components/portal/side-cards";
import { WorkplanProgressTable } from "@/components/portal/workplan-progress-table";
import { getPortalProjectDetail } from "@/lib/portal/queries";

export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detail = await getPortalProjectDetail(id);
  if (!detail) notFound();

  const {
    project,
    phases,
    manager,
    announcements,
    recentActivity,
    documents,
    nextMilestone,
  } = detail;

  const totalActivities = phases.reduce((sum, p) => sum + p.activities.length, 0);
  const projectStatus = (project.status ?? "active") as
    | "planning"
    | "active"
    | "paused"
    | "completed";

  const subtitle = [project.code, project.client?.name]
    .filter(Boolean)
    .join(" / ");
  const referenceDate = new Date().toISOString();

  return (
    <div className="space-y-6">
      <PageHeader
        backFallbackHref="/portal"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span>{project.name}</span>
            <StatusPill status={projectStatus} />
          </span>
        }
        subtitle={subtitle || undefined}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <OverallProgressCard
          done={project.doneCount}
          total={project.totalCount}
          health="good"
        />
        <TimelineCard
          startDate={project.start_date}
          endDate={project.end_date}
          referenceDate={referenceDate}
        />
        <WorkplanCard
          phases={phases.length}
          activities={totalActivities}
        />
        <MilestoneCard
          title={nextMilestone?.name ?? null}
          date={nextMilestone?.planned_date ?? null}
          referenceDate={referenceDate}
        />
        <ManagerCard manager={manager} />
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

          <RecentActivityCard items={recentActivity} projectId={project.id} />
        </div>

        <div className="space-y-6">
          <AnnouncementsCard items={announcements} projectId={project.id} />
          <KeyDocumentsCard documents={documents} projectId={project.id} />
          <NeedHelpCard manager={manager} />
        </div>
      </div>
    </div>
  );
}
