import Link from "next/link";
import { CalendarDays, CheckCircle2, FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { ProjectProgress } from "@/components/workspace/project-progress";
import { getPortalProjectDetail } from "@/lib/portal/queries";

export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { project, phases, doneActivities, nextMilestone, percentComplete } =
    await getPortalProjectDetail(id);

  const lastCompleted = doneActivities[0]?.completed_date ?? null;

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle="Live progress and completion evidence from DC&A Hub."
        backFallbackHref="/portal"
      />

      <section className="mb-6 rounded-[var(--admin-card-radius)] border bg-card p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-sm text-muted-foreground">Overall progress</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">{percentComplete}%</p>
            <div className="mt-4 max-w-xl">
              <ProjectProgress done={project.doneCount} total={project.totalCount} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-background p-3">
              <CheckCircle2 className="mb-2 size-4 text-primary" />
              <p className="text-xs text-muted-foreground">Last completed</p>
              <p className="text-sm font-medium">{lastCompleted ?? "None yet"}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <CalendarDays className="mb-2 size-4 text-primary" />
              <p className="text-xs text-muted-foreground">Next milestone</p>
              <p className="text-sm font-medium">
                {nextMilestone?.planned_date ?? "Not scheduled"}
              </p>
            </div>
            <div className="rounded-lg border bg-background p-3 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Project dates</p>
              <p className="text-sm font-medium">
                {project.start_date ?? "TBD"} - {project.end_date ?? "TBD"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {phases.map((phase) => (
            <SectionCard key={phase.id} title={phase.name} description={phase.description ?? undefined}>
              <div className="grid gap-2">
                {phase.activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activities yet.</p>
                ) : (
                  phase.activities.map((activity) => {
                    const content = (
                      <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{activity.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {activity.planned_date ?? "No planned date"}
                          </p>
                        </div>
                        <ActivityStatus status={activity.status} />
                      </div>
                    );
                    return activity.status === "done" ? (
                      <Link
                        key={activity.id}
                        href={`/portal/projects/${id}/activities/${activity.id}`}
                        className="block"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={activity.id}>{content}</div>
                    );
                  })
                )}
              </div>
            </SectionCard>
          ))}
        </div>

        <SectionCard
          title="Recent completions"
          description="Newest completed activities with available proof."
        >
          {doneActivities.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No completed activities yet"
              description="Completed work will appear here."
            />
          ) : (
            <div className="space-y-2">
              {doneActivities.slice(0, 10).map((activity) => (
                <Link
                  key={activity.id}
                  href={`/portal/projects/${id}/activities/${activity.id}`}
                  className="block rounded-lg border bg-background p-3 transition-colors hover:bg-accent"
                >
                  <p className="text-sm font-medium">{activity.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activity.phaseName} / {activity.completed_date ?? "Completed"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
