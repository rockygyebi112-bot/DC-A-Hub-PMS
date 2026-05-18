import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ActivityStatus } from "@/components/workspace/status-badge";
import type { WorkspaceActivity } from "@/lib/workspace/queries";

/**
 * "Timeline" tab: a left-rail of dated activities sorted ascending. Reads
 * planned_date first, falls back to completed_date for past work. Anything
 * without a date is excluded — the empty state nudges users to add one.
 */
export function ProjectTimeline({
  projectId,
  activities,
}: {
  projectId: string;
  activities: (WorkspaceActivity & { phaseName: string })[];
}) {
  const scheduled = activities
    .filter((activity) => activity.planned_date || activity.completed_date)
    .sort((a, b) =>
      (a.planned_date ?? a.completed_date ?? "").localeCompare(
        b.planned_date ?? b.completed_date ?? "",
      ),
    );

  if (scheduled.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          icon={CalendarDays}
          title="No scheduled work"
          description="Add planned or completed dates to see the timeline."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <ol className="relative space-y-4 border-l pl-5">
        {scheduled.map((activity) => (
          <li key={activity.id} className="relative">
            <span className="absolute -left-[1.65rem] top-1.5 size-3 rounded-full border-2 border-background bg-primary" />
            <Link
              href={`/workspace/projects/${projectId}/activities/${activity.id}`}
              className="block rounded-lg border bg-background p-3 transition-colors hover:bg-accent"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{activity.name}</p>
                  <p className="text-xs text-muted-foreground">{activity.phaseName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ActivityStatus status={activity.status} />
                  <time className="text-xs text-muted-foreground">
                    {activity.planned_date ?? activity.completed_date}
                  </time>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
