import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronDown,
  UserRound,
} from "lucide-react";

import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { setTaskStatus } from "@/lib/internal/actions";
import { cn } from "@/lib/utils";
import { TaskCard, type TaskRow } from "./task-card";
import { NewTaskForm } from "./new-task-form";
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  asTaskStatus,
  type TaskPriority,
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
                <span className={cn("size-2.5 rounded-full", statusTone(status, "bar"))} />
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
    <div className="overflow-hidden rounded-xl border border-border/70 bg-white shadow-sm">
      {TASK_STATUS_ORDER.map((status) => {
        const meta = TASK_STATUS_META[status];
        const list = byStatus.get(status)!;
        return (
          <section key={status} className="border-b border-border/60 last:border-b-0">
            <header className="flex items-center gap-2 bg-muted/30 px-4 py-3">
              <span className={cn("h-4 w-1 rounded-full", statusTone(status, "bar"))} />
              <ChevronDown className="size-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                {meta.label} ({list.length})
              </h3>
            </header>
            <div>
              {list.length === 0 ? (
                <div className="px-4 py-5 text-xs text-muted-foreground">No tasks in this section.</div>
              ) : (
                list.map((task) => (
                  <TaskListRow
                    key={task.id}
                    task={task}
                    area={areaById.get(task.area_id)}
                  />
                ))
              )}
              <div className="px-4 py-2">
                <NewTaskForm
                  areas={areas}
                  projects={projects}
                  defaultStatus={status}
                  triggerLabel="Add task"
                  triggerVariant="ghost"
                  triggerSize="sm"
                  triggerClassName="text-muted-foreground"
                />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TaskListRow({ task, area }: { task: Task; area?: Area }) {
  const assignee = (task.assignees ?? []).find((a) => a.profile);
  const overdue = !!task.due_date && task.status !== "done" && task.due_date < todayIso();
  const priority =
    task.priority && task.priority in TASK_PRIORITY_META
      ? TASK_PRIORITY_META[task.priority as TaskPriority]
      : null;

  async function markDone() {
    "use server";
    await setTaskStatus(task.id, "done");
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_8rem_7rem_6rem_10rem] items-center gap-3 border-b border-border/50 px-4 py-2.5 last:border-b-0 hover:bg-gray-50">
      <form action={markDone}>
        <button
          type="submit"
          aria-label="Mark task done"
          className={cn(
            "grid size-4 place-items-center rounded border border-input bg-white text-white transition-colors hover:border-primary",
            task.status === "done" && "border-emerald-500 bg-emerald-500",
          )}
        >
          {task.status === "done" && <Check className="size-3" />}
        </button>
      </form>
      <Link
        href={`/workspace/internal/${task.id}`}
        className="min-w-0 truncate text-sm font-medium text-gray-900 hover:text-primary"
      >
        {task.title}
      </Link>
      <div className="min-w-0">
        {assignee?.profile ? (
          <UserAvatar
            email={assignee.user_id}
            name={assignee.profile.full_name ?? "Unknown"}
            avatarUrl={assignee.profile.avatar_url}
            size="sm"
          />
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <UserRound className="size-3.5" />
            -
          </span>
        )}
      </div>
      <div
        className={cn(
          "inline-flex items-center gap-1 text-xs",
          overdue ? "font-medium text-red-600" : "text-muted-foreground",
        )}
      >
        {task.due_date ? (
          <>
            <CalendarDays className="size-3.5" />
            {formatDue(task.due_date)}
          </>
        ) : (
          "-"
        )}
      </div>
      <span
        className={cn(
          "w-fit rounded-md px-2 py-0.5 text-xs font-medium",
          task.priority === "urgent" && "bg-red-50 text-red-700",
          task.priority === "high" && "bg-amber-50 text-amber-700",
          task.priority === "normal" && "bg-blue-50 text-blue-700",
          task.priority === "low" && "bg-slate-100 text-slate-600",
          !priority && "text-muted-foreground",
        )}
      >
        {priority?.label ?? "-"}
      </span>
      <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        {area && (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full bg-muted-foreground/50"
            style={area.color ? { backgroundColor: area.color } : undefined}
          />
        )}
        <span className="truncate">{area?.name ?? "-"}</span>
      </span>
    </div>
  );
}

function statusTone(status: TaskStatus, part: "soft" | "text" | "bar") {
  if (status === "in_progress") {
    return part === "soft" ? "bg-blue-50" : part === "text" ? "text-blue-600" : "bg-blue-500";
  }
  if (status === "blocked") {
    return part === "soft" ? "bg-red-50" : part === "text" ? "text-red-500" : "bg-red-500";
  }
  if (status === "done") {
    return part === "soft" ? "bg-emerald-50" : part === "text" ? "text-emerald-600" : "bg-emerald-500";
  }
  return part === "soft" ? "bg-slate-100" : part === "text" ? "text-slate-500" : "bg-slate-300";
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
