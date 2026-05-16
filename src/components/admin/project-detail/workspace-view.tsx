import { NextMilestonesCard } from "@/components/admin/project-detail/parts";
import { ProjectHero } from "./workspace-view/project-hero";
import { SnapshotStrip } from "./workspace-view/snapshot-strip";
import { WorkplanCard } from "./workspace-view/workplan-card";
import { ProjectHealthCard } from "./workspace-view/project-health-card";
import { UpcomingDeadlinesCard } from "./workspace-view/upcoming-deadlines-card";
import { RecentUpdatesCard } from "./workspace-view/recent-updates-card";
import type { WorkspaceViewProps } from "./workspace-view/types";

// Re-export the public types so the admin project page can keep importing
// them from this entry. Sub-components consume them directly from ./types.
export type {
  WVActivity,
  WVPhase,
  WVMilestone,
  WVUpdate,
  WorkspaceViewProps,
} from "./workspace-view/types";

/**
 * Workspace view composer. Was a 1,134-line single-file god component; the
 * individual cards now live next to their own state in
 * `./workspace-view/*` so each piece can be edited, tested, and re-rendered
 * independently. This file is just the layout grid that wires them together.
 */
export function WorkspaceView(props: WorkspaceViewProps) {
  return (
    <div className="space-y-6">
      <ProjectHero {...props} />
      <SnapshotStrip {...props} />

      <NextMilestonesCard
        milestones={props.nextMilestones}
        viewAllHref={`/workspace/projects/${props.projectId}`}
        now={props.now}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-9">
          <WorkplanCard phases={props.phases} projectId={props.projectId} />
        </div>
        <aside className="space-y-4 xl:col-span-3">
          <div className="xl:sticky xl:top-[88px] xl:space-y-4">
            <ProjectHealthCard
              health={props.health}
              overdueCount={props.overdueCount}
              dueThisWeek={props.dueThisWeek}
            />
            <UpcomingDeadlinesCard
              items={props.upcomingDeadlines}
              viewAllHref={`/workspace/projects/${props.projectId}`}
            />
            <RecentUpdatesCard
              items={props.recentUpdates}
              viewAllHref={`/workspace/projects/${props.projectId}`}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
