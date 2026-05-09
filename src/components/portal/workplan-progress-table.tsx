import type { WorkspacePhase } from "@/lib/workspace/queries";
import { cn } from "@/lib/utils";

type PhaseStatus = "completed" | "in_progress" | "not_started";

const STATUS_LABEL: Record<PhaseStatus, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  not_started: "Not Started",
};

const STATUS_STYLE: Record<PhaseStatus, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  not_started: "bg-muted text-muted-foreground border-border",
};

const BAR_COLOR: Record<PhaseStatus, string> = {
  completed: "bg-emerald-500",
  in_progress: "bg-blue-500",
  not_started: "bg-muted-foreground/30",
};

function derivePhaseStatus(done: number, total: number): PhaseStatus {
  if (total === 0) return "not_started";
  if (done === total) return "completed";
  if (done > 0) return "in_progress";
  return "not_started";
}

export function WorkplanProgressTable({
  phases,
}: {
  phases: WorkspacePhase[];
}) {
  const rows = phases.map((phase, index) => {
    const total = phase.activities.length;
    const done = phase.activities.filter((a) => a.status === "done").length;
    const inProgress = phase.activities.filter((a) => a.status === "in_progress").length;
    const status = inProgress > 0 && done < total
      ? "in_progress"
      : derivePhaseStatus(done, total);
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { phase, index, total, done, status, percent };
  });

  return (
    <section className="rounded-[14px] border bg-card shadow-card">
      <header className="border-b px-5 py-4">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Workplan progress
        </h2>
        <p className="text-xs text-muted-foreground">
          Overview of project phases and completion status.
        </p>
      </header>
      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No phases yet.
        </div>
      ) : (
        <div>
          <div className="hidden border-b bg-muted/40 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(0,2.2fr)_minmax(0,2.6fr)_auto] sm:gap-4">
            <span>Phase</span>
            <span>Progress</span>
            <span>Status</span>
          </div>
          <ul className="divide-y">
            {rows.map(({ phase, index, total, done, status, percent }) => (
              <li
                key={phase.id}
                className="grid grid-cols-1 gap-3 px-5 py-3 transition-colors hover:bg-muted/30 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,2.6fr)_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    <span className="text-muted-foreground">{index + 1}.</span>{" "}
                    {phase.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {done} / {total} activit{total === 1 ? "y" : "ies"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", BAR_COLOR[status])}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {percent}%
                  </span>
                </div>
                <span
                  className={cn(
                    "justify-self-start whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    STATUS_STYLE[status],
                  )}
                >
                  {STATUS_LABEL[status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
