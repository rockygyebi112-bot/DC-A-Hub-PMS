import Link from "next/link";
import {
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  ListChecks,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { ProjectProgress } from "@/components/workspace/project-progress";
import { WorkplanImportForm } from "@/components/workspace/workplan-import-form";
import type { WorkspacePhase } from "@/lib/workspace/queries";

type Props = {
  projectId: string;
  phases: WorkspacePhase[];
};

export function ProjectWorkplanPanel({ projectId, phases }: Props) {
  const activities = phases.flatMap((phase) =>
    phase.activities.map((activity) => ({ ...activity, phaseName: phase.name })),
  );
  const doneCount = activities.filter((activity) => activity.status === "done").length;
  const totalCount = activities.length;
  const nextActivity =
    activities
      .filter((activity) => activity.status !== "done" && activity.planned_date)
      .sort((a, b) => (a.planned_date ?? "").localeCompare(b.planned_date ?? ""))[0] ??
    null;

  return (
    <SectionCard
      title="Checklist and workplan"
      description="Build the project checklist here, then preview the exact progress page clients use."
      action={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/workspace/projects/${projectId}`} />}
          >
            <ListChecks className="size-4" />
            Manage workplan
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/portal/projects/${projectId}`} />}
          >
            <Eye className="size-4" />
            Client view
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/admin/projects/${projectId}/team`} />}
          >
            <Users className="size-4" />
            Access
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-background p-4">
            <p className="mb-3 text-xs font-medium uppercase text-muted-foreground">
              Client progress
            </p>
            <ProjectProgress done={doneCount} total={totalCount} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <SmallMetric label="Phases" value={phases.length} />
            <SmallMetric label="Checklist items" value={totalCount} />
            <SmallMetric label="Completed" value={doneCount} />
          </div>

          <div className="rounded-lg border bg-background p-4">
            <div className="mb-3 flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Import checklist</p>
            </div>
            <WorkplanImportForm projectId={projectId} />
          </div>
        </div>

        <div className="min-w-0">
          {phases.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="No checklist yet"
              description="Import an Excel workplan or open the workplan board to add phases and activities."
              action={
                <Button render={<Link href={`/workspace/projects/${projectId}`} />}>
                  <ListChecks className="size-4" />
                  Open workplan board
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs font-medium text-muted-foreground">Next item</p>
                  <p className="mt-1 truncate text-sm font-semibold">
                    {nextActivity?.name ?? "No scheduled item"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nextActivity?.planned_date ?? "Add planned dates in the workplan"}
                  </p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <CheckCircle2 className="mb-2 size-4 text-primary" />
                  <p className="text-xs font-medium text-muted-foreground">Client portal</p>
                  <p className="mt-1 text-sm font-semibold">
                    {doneCount}/{totalCount} visible as complete
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-background">
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">Current checklist</p>
                </div>
                <div className="divide-y">
                  {phases.map((phase) => (
                    <div key={phase.id} className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{phase.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {phase.activities.length} item{phase.activities.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          render={<Link href={`/workspace/projects/${projectId}/phases/${phase.id}`} />}
                        >
                          Edit phase
                        </Button>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {phase.activities.slice(0, 4).map((activity) => (
                          <Link
                            key={activity.id}
                            href={`/workspace/projects/${projectId}/activities/${activity.id}`}
                            className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 transition-colors hover:bg-accent"
                          >
                            <span className="truncate text-sm">{activity.name}</span>
                            <ActivityStatus status={activity.status} />
                          </Link>
                        ))}
                        {phase.activities.length > 4 && (
                          <p className="text-xs text-muted-foreground">
                            +{phase.activities.length - 4} more in this phase
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
