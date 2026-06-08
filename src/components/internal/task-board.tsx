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
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <div className="grid min-w-[920px] grid-cols-4 gap-3 xl:min-w-0">
      {TASK_STATUS_ORDER.map((status) => {
        const meta = TASK_STATUS_META[status];
        const Icon = meta.icon;
        const list = byStatus.get(status)!;
        return (
          <section
            key={status}
            className="flex min-h-[420px] flex-col rounded-lg border border-border bg-muted/35"
          >
            <header className="flex h-12 items-center gap-2 border-b border-border px-3">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-md bg-background",
                  status === "not_started" && "text-muted-foreground",
                  status === "in_progress" && "text-blue-500",
                  status === "blocked" && "text-red-500",
                  status === "done" && "text-emerald-500",
                )}
              >
                <Icon className="size-4" />
              </span>
              <h2 className="min-w-0 truncate text-sm font-semibold tracking-tight">
                {meta.label}
              </h2>
              <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {list.length}
              </span>
            </header>

            <div className="flex flex-1 flex-col gap-2 p-2.5">
              {list.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-background/50 px-3 py-8 text-center text-xs text-muted-foreground">
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
    </div>
  );
}
