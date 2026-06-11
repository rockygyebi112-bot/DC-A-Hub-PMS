import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";

import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { setTaskStatus } from "@/lib/internal/actions";
import { cn } from "@/lib/utils";
import { TaskCard, type TaskRow } from "./task-card";
import { NewTaskForm } from "./new-task-form";
import {
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  asTaskStatus,
  type TaskStatus,
} from "./task-meta";

type Area = { id: string; name: string; color?: string | null };
type Project = { id: string; name: string; client?: { name: string } | null };
type Task = TaskRow & { area_id: string };
type ViewMode = "board" | "list";

export function TaskBoard({
  tasks,
  areas,
  projects = [],
  view = "board",
}: {
  tasks: Task[];
  areas: Area[];
  projects?: Project[];
  view?: ViewMode;
}) {
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const byStatus = new Map(TASK_STATUS_ORDER.map((s) => [s, [] as Task[]]));
  for (const t of tasks) byStatus.get(asTaskStatus(t.status))!.push(t);

  if (view === "list") {
    return (
      <TaskListView
        areas={areas}
        projects={projects}
        areaById={areaById}
        byStatus={byStatus}
      />
    );
  }

  return (
    <div className="-mx-4 min-h-0 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
      <div className="grid h-[calc(100vh-var(--topbar-height,58px)-16rem)] min-h-[560px] min-w-[1080px] grid-cols-4 gap-4 2xl:min-w-0">
        {TASK_STATUS_ORDER.map((status) => {
          const meta = TASK_STATUS_META[status];
          const list = byStatus.get(status)!;

          return (
            <section key={status} className="flex min-h-0 flex-col">
              <header className="flex shrink-0 items-center gap-2 px-1 pb-2">
                <span className={cn("size-2.5 rounded-full", statusDot(status))} />
                <h3 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-foreground">
                  {meta.label}
                </h3>
                <span className="text-xs tabular-nums text-muted-foreground">{list.length}</span>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="flex flex-col gap-2">
                  {list.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      area={areaById.get(t.area_id) ?? undefined}
                      project={t.project_id ? projectById.get(t.project_id) : undefined}
                    />
                  ))}
                  <NewTaskForm
                    areas={areas}
                    projects={projects}
                    defaultStatus={status}
                    triggerLabel="Add task"
                    triggerVariant="ghost"
                    triggerSize="sm"
                    triggerClassName="w-full justify-start text-muted-foreground hover:bg-muted/60"
                  />
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const LIST_COLS = "grid-cols-[minmax(0,1fr)_11rem_7rem]";

function TaskListView({
  areas,
  projects,
  areaById,
  byStatus,
}: {
  areas: Area[];
  projects: Project[];
  areaById: Map<string, Area>;
  byStatus: Map<TaskStatus, Task[]>;
}) {
  return (
    <div className="-mx-4 overflow-x-auto md:mx-0">
      <div className="min-w-[680px]">
        <div
          className={cn(
            "grid items-center gap-3 border-y border-border px-3 py-2 text-xs font-medium text-muted-foreground",
            LIST_COLS,
          )}
        >
          <span className="pl-[26px]">Name</span>
          <span>Assignee</span>
          <span>Due date</span>
        </div>

        {TASK_STATUS_ORDER.map((status) => {
          const meta = TASK_STATUS_META[status];
          const list = byStatus.get(status)!;
          return (
            <details key={status} open className="group/sec border-b border-border/60">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 hover:bg-muted/30">
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-[[open]]/sec:rotate-90" />
                <span className={cn("size-2 shrink-0 rounded-full", statusDot(status))} />
                <span className="text-sm font-semibold text-foreground">{meta.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{list.length}</span>
              </summary>

              <div>
                {list.map((task) => (
                  <TaskListRow key={task.id} task={task} area={areaById.get(task.area_id)} />
                ))}
                <div className="border-t border-border/40 py-1 pl-[42px] pr-3">
                  <NewTaskForm
                    areas={areas}
                    projects={projects}
                    defaultStatus={status}
                    triggerLabel="Add task..."
                    triggerVariant="ghost"
                    triggerSize="sm"
                    triggerClassName="h-8 w-full justify-start px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                  />
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function TaskListRow({ task, area }: { task: Task; area?: Area }) {
  const assignee = (task.assignees ?? []).find((a) => a.profile);
  const done = asTaskStatus(task.status) === "done";
  const overdue = !!task.due_date && !done && task.due_date < todayIso();

  async function toggleDone() {
    "use server";
    await setTaskStatus(task.id, done ? "not_started" : "done");
  }

  return (
    <div
      className={cn(
        "group/row grid items-center gap-3 border-t border-border/40 px-3 py-2 hover:bg-muted/30",
        LIST_COLS,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <form action={toggleDone} className="flex">
          <button
            type="submit"
            aria-label={done ? "Mark task incomplete" : "Mark task complete"}
            className={cn(
              "grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors",
              done
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-muted-foreground/40 text-transparent hover:border-emerald-500 hover:text-emerald-500",
            )}
          >
            <Check className="size-3" strokeWidth={3} />
          </button>
        </form>
        {area && (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full bg-muted-foreground/40"
            style={area.color ? { backgroundColor: area.color } : undefined}
            title={area.name}
          />
        )}
        <Link
          href={`/workspace/internal/${task.id}`}
          className={cn(
            "min-w-0 truncate text-sm text-foreground hover:underline",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </Link>
      </div>

      <div className="min-w-0">
        {assignee?.profile ? (
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar
              email={assignee.user_id}
              name={assignee.profile.full_name ?? "Unknown"}
              avatarUrl={assignee.profile.avatar_url}
              size="sm"
            />
            <span className="truncate text-xs text-muted-foreground">
              {assignee.profile.full_name ?? "Unknown"}
            </span>
          </span>
        ) : (
          <span className="grid size-6 place-items-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground">
            —
          </span>
        )}
      </div>

      <div>
        {task.due_date ? (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs",
              overdue ? "bg-red-500/10 font-medium text-red-600" : "text-muted-foreground",
            )}
          >
            {formatDue(task.due_date)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

function statusDot(status: TaskStatus) {
  if (status === "in_progress") return "bg-blue-500";
  if (status === "blocked") return "bg-red-500";
  if (status === "done") return "bg-emerald-500";
  return "bg-slate-300";
}

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate(),
  ).padStart(2, "0")}`;
}

function formatDue(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
