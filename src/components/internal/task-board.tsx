import { cn } from "@/lib/utils";
import { TaskCard, type TaskRow } from "./task-card";
import { NewTaskForm } from "./new-task-form";
import { TASK_STATUS_META, TASK_STATUS_ORDER, asTaskStatus } from "./task-meta";

type Area = { id: string; name: string; color?: string | null };
type Task = TaskRow & { area_id: string };

/**
 * Kanban-style board: one column per task status. Area is no longer the
 * grouping axis (it's a filter + a tag on each card), so the board reads the
 * way an internal task workspace is expected to — Not started → Done.
 */
export function TaskBoard({ tasks, areas }: { tasks: Task[]; areas: Area[] }) {
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const byStatus = new Map(TASK_STATUS_ORDER.map((s) => [s, [] as Task[]]));
  for (const t of tasks) byStatus.get(asTaskStatus(t.status))!.push(t);

  return (
    <div className="-mx-4 min-h-0 flex-1 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <div className="grid h-[calc(100vh-var(--topbar-height,58px)-15rem)] min-h-[520px] min-w-[1120px] grid-cols-4 gap-3 xl:min-w-0">
        {TASK_STATUS_ORDER.map((status) => {
          const meta = TASK_STATUS_META[status];
          const Icon = meta.icon;
          const list = byStatus.get(status)!;
          return (
            <section
              key={status}
              className="flex min-h-0 flex-col rounded-lg border border-border bg-muted/45"
            >
              <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
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

              <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                <div className="flex flex-col gap-2">
                  {list.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border bg-background/60 px-3 py-8 text-center text-xs text-muted-foreground">
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
              </div>

              <div className="shrink-0 border-t border-border p-2">
                <NewTaskForm
                  areas={areas}
                  triggerLabel="Add task"
                  triggerVariant="ghost"
                  triggerSize="sm"
                  triggerClassName="w-full justify-start text-muted-foreground"
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
