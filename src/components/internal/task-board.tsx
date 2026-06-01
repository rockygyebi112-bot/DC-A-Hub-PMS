import { ClipboardList } from "lucide-react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/admin/ui/section-card";
import { TaskCard, type TaskRow } from "./task-card";
import { TASK_STATUS_META, TASK_STATUS_ORDER, asTaskStatus } from "./task-meta";

type Area = { id: string; name: string; color?: string | null };
type Task = TaskRow & { area_id: string };

/**
 * Kanban-style board: one column per task status. Area is no longer the
 * grouping axis (it's a filter + a tag on each card), so the board reads the
 * way an internal task workspace is expected to — Not started → Done.
 */
export function TaskBoard({ tasks, areas }: { tasks: Task[]; areas: Area[] }) {
  if (tasks.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          variant="page"
          icon={ClipboardList}
          title="No tasks here"
          description="Nothing matches the current filters. Create a task or clear the filters above."
        />
      </SectionCard>
    );
  }

  const areaById = new Map(areas.map((a) => [a.id, a]));
  const byStatus = new Map(TASK_STATUS_ORDER.map((s) => [s, [] as Task[]]));
  for (const t of tasks) byStatus.get(asTaskStatus(t.status))!.push(t);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUS_ORDER.map((status) => {
        const meta = TASK_STATUS_META[status];
        const list = byStatus.get(status)!;
        return (
          <section
            key={status}
            className="flex flex-col rounded-xl border border-border bg-muted/30 p-3"
          >
            <header className="mb-3 flex items-center gap-2 px-1">
              <span
                aria-hidden
                className={cn("size-2 rounded-full", meta.dot)}
              />
              <h2 className="text-sm font-semibold tracking-tight">
                {meta.label}
              </h2>
              <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {list.length}
              </span>
            </header>

            <div className="flex flex-col gap-2">
              {list.length === 0 ? (
                <p className="px-1 py-8 text-center text-xs text-muted-foreground">
                  No tasks
                </p>
              ) : (
                list.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    area={areaById.get(t.area_id) ?? undefined}
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
