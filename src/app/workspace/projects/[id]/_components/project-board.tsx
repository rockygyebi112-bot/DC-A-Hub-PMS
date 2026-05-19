import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  Columns3,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { DeleteConfirm } from "@/components/workspace/delete-confirm";
import { deleteActivity } from "@/lib/workspace/actions";
import type { WorkspaceActivity, WorkspacePhase } from "@/lib/workspace/queries";

const BOARD_COLUMNS: {
  key: WorkspaceActivity["status"];
  label: string;
  icon: LucideIcon;
}[] = [
  { key: "not_started", label: "Not started", icon: ClipboardList },
  { key: "in_progress", label: "Ongoing", icon: Columns3 },
  { key: "done", label: "Done", icon: CheckCircle2 },
];

/**
 * Kanban-ish "Board" tab: three columns by activity status with per-card
 * delete. The parent page passes the activity list pre-flattened with
 * phaseName attached so we don't re-walk the phase tree per render.
 */
export function ProjectBoard({
  projectId,
  phases,
  activities,
}: {
  projectId: string;
  phases: WorkspacePhase[];
  activities: (WorkspaceActivity & { phaseName: string })[];
}) {
  if (phases.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          variant="page"
          icon={ClipboardList}
          title="No phases"
          description="Create the first phase to start building the workplan."
        />
      </SectionCard>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      {BOARD_COLUMNS.map((column) => {
        const Icon = column.icon;
        const rows = activities.filter((activity) => activity.status === column.key);
        return (
          <section key={column.key} className="rounded-xl border bg-muted/30">
            <header className="flex items-center justify-between gap-3 border-b px-3 py-2">
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{column.label}</h2>
              </div>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                {rows.length}
              </span>
            </header>
            <div className="space-y-2 p-2">
              {rows.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-background/60 px-3 py-8 text-center text-xs text-muted-foreground">
                  Empty
                </div>
              ) : (
                rows.map((activity) => (
                  <BoardActivityCard
                    key={activity.id}
                    projectId={projectId}
                    activity={activity}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BoardActivityCard({
  projectId,
  activity,
}: {
  projectId: string;
  activity: WorkspaceActivity & { phaseName: string };
}) {
  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm transition-colors hover:bg-accent/50">
      <div className="flex items-start justify-between gap-2">
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
          <p className="mt-1 truncate text-xs text-muted-foreground">{activity.phaseName}</p>
        </Link>
        <ActivityStatus status={activity.status} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{activity.planned_date ?? "No date"}</span>
          {activity.responsible && <span>· {activity.responsible}</span>}
          {activity.proofCount > 0 && (
            <span>
              · {activity.proofCount} document{activity.proofCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <DeleteConfirm
          trigger={
            <button
              type="button"
              aria-label="Delete activity"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          }
          title="Delete activity"
          description={
            <>
              Delete <strong>{activity.name}</strong>? This will remove all documents uploaded to it.
            </>
          }
          action={async () => {
            "use server";
            return deleteActivity(activity.id);
          }}
        />
      </div>
    </div>
  );
}
