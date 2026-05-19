import Link from "next/link";
import { ChevronDown, Layers } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { ActivityStatus } from "@/components/workspace/status-badge";
import type { WorkspacePhase } from "@/lib/workspace/queries";

/**
 * Phases tab content — collapsible per-phase cards with their activity list
 * and a progress bar derived from done/total counts. Pure presentational
 * server component; the parent page passes the data shape it already loaded.
 */
export function ProjectPhases({
  projectId,
  phases,
}: {
  projectId: string;
  phases: WorkspacePhase[];
}) {
  if (phases.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          variant="page"
          icon={Layers}
          title="No phases yet"
          description="Create the first phase to start building the workplan."
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {phases.map((phase) => {
        const total = phase.activities.length;
        const done = phase.activities.filter((a) => a.status === "done").length;
        const inProgress = phase.activities.filter((a) => a.status === "in_progress").length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        const phaseStatus: "planning" | "active" | "completed" =
          total === 0 ? "planning" : done === total ? "completed" : "active";

        return (
          <details
            key={phase.id}
            open
            className="group rounded-[var(--admin-card-radius)] border bg-card shadow-card transition-smooth hover:shadow-card-hover"
          >
            <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-0 -rotate-90" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-heading truncate text-sm font-semibold tracking-tight">
                    {phase.name}
                  </h3>
                  <StatusPill status={phaseStatus} />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {done}/{total} done
                    {inProgress > 0 ? ` · ${inProgress} in progress` : ""}
                  </span>
                </div>
                {(phase.start_date || phase.end_date || phase.description) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {phase.start_date || phase.end_date
                      ? `${phase.start_date ?? "TBD"} – ${phase.end_date ?? "TBD"}`
                      : ""}
                    {phase.description ? ` · ${phase.description}` : ""}
                  </p>
                )}
                <div className="progress-bar-track mt-3">
                  <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="text-right">
                <div className="stat-number text-2xl leading-none">{pct}%</div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  complete
                </p>
              </div>
            </summary>

            <div className="border-t px-5 py-3">
              {phase.activities.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
                  No activities in this phase yet.
                </p>
              ) : (
                <ul className="divide-y">
                  {phase.activities.map((activity) => (
                    <li
                      key={activity.id}
                      className="flex flex-wrap items-center gap-3 py-2.5"
                    >
                      <Link
                        href={`/workspace/projects/${projectId}/activities/${activity.id}`}
                        className="min-w-0 flex-1"
                      >
                        <p className="flex items-center gap-2 truncate text-sm font-medium hover:underline">
                          <span className="truncate">{activity.name}</span>
                          {activity.visibility === "internal" && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                              Internal
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{activity.planned_date ?? "No date"}</span>
                          {activity.responsible && <span>· {activity.responsible}</span>}
                          {activity.proofCount > 0 && (
                            <span>
                              · {activity.proofCount} document
                              {activity.proofCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </p>
                      </Link>
                      <ActivityStatus status={activity.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
