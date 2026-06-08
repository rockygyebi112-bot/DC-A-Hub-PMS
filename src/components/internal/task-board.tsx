import { cn } from "@/lib/utils";
import { TaskCard, type TaskRow } from "./task-card";
import { NewTaskForm } from "./new-task-form";
import { TASK_STATUS_META, TASK_STATUS_ORDER, asTaskStatus } from "./task-meta";

type Area = { id: string; name: string; color?: string | null };
type Project = { id: string; name: string; client?: { name: string } | null };
type Task = TaskRow & { area_id: string };

export function TaskBoard({
  tasks,
  areas,
  projects = [],
}: {
  tasks: Task[];
  areas: Area[];
  projects?: Project[];
}) {
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const byStatus = new Map(TASK_STATUS_ORDER.map((s) => [s, [] as Task[]]));
  for (const t of tasks) byStatus.get(asTaskStatus(t.status))!.push(t);
  const total = Math.max(tasks.length, 1);

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Delivery board</h2>
          <p className="text-xs text-muted-foreground">
            Move work from intake to completion with owners, deadlines, and blockers visible.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-md border border-border bg-background px-2 py-1">
            {tasks.length} visible tasks
          </span>
          <span className="rounded-md border border-border bg-background px-2 py-1">
            {projects.length} linked projects
          </span>
        </div>
      </header>

      <div className="-mx-4 min-h-0 overflow-x-auto px-4 py-4 md:mx-0 md:px-4">
        <div className="grid h-[calc(100vh-var(--topbar-height,58px)-19rem)] min-h-[560px] min-w-[1120px] grid-cols-4 gap-3 2xl:min-w-0">
          {TASK_STATUS_ORDER.map((status) => {
            const meta = TASK_STATUS_META[status];
            const Icon = meta.icon;
            const list = byStatus.get(status)!;
            const urgentCount = list.filter((t) => t.priority === "urgent").length;
            const percent = Math.round((list.length / total) * 100);

            return (
              <section
                key={status}
                className="flex min-h-0 flex-col rounded-lg border border-border bg-muted/35"
              >
                <header className="shrink-0 border-b border-border bg-card/70 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md bg-background",
                        status === "not_started" && "text-muted-foreground",
                        status === "in_progress" && "text-blue-500",
                        status === "blocked" && "text-red-500",
                        status === "done" && "text-emerald-500",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold tracking-tight">
                        {meta.label}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {percent}% of visible work
                      </p>
                    </div>
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                      {list.length}
                    </span>
                  </div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-background">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        status === "not_started" && "bg-muted-foreground/45",
                        status === "in_progress" && "bg-blue-500",
                        status === "blocked" && "bg-red-500",
                        status === "done" && "bg-emerald-500",
                      )}
                      style={{ width: `${Math.max(percent, list.length > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  {urgentCount > 0 && (
                    <p className="mt-2 text-xs font-medium text-destructive">
                      {urgentCount} urgent in this lane
                    </p>
                  )}
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                  <div className="flex flex-col gap-2">
                    {list.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border bg-background/60 px-3 py-8 text-center">
                        <p className="text-xs font-medium text-foreground">No tasks</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Add work here when this lane needs attention.
                        </p>
                      </div>
                    ) : (
                      list.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          area={areaById.get(t.area_id) ?? undefined}
                          project={t.project_id ? projectById.get(t.project_id) : undefined}
                        />
                      ))
                    )}
                  </div>
                </div>

                <div className="shrink-0 border-t border-border p-2">
                  <NewTaskForm
                    areas={areas}
                    projects={projects}
                    defaultStatus={status}
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
    </div>
  );
}
