import Link from "next/link";
import { Check } from "lucide-react";

import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { setTaskStatus } from "@/lib/internal/actions";
import { cn } from "@/lib/utils";
import { TaskCard, type TaskRow } from "./task-card";
import { NewTaskForm } from "./new-task-form";
import { AddSection, CollapsibleSection, SectionHeading } from "./section-controls";
import { TASK_STATUS_META, asTaskStatus, type TaskStatus } from "./task-meta";

type Section = { id: string; name: string; color?: string | null };
type Project = { id: string; name: string; client?: { name: string } | null };
type Task = TaskRow & { area_id: string };
type ViewMode = "board" | "list";

export function TaskBoard({
  tasks,
  sections,
  projects = [],
  view = "list",
  canManage = false,
}: {
  tasks: Task[];
  sections: Section[];
  projects?: Project[];
  view?: ViewMode;
  canManage?: boolean;
}) {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const bySection = new Map(sections.map((s) => [s.id, [] as Task[]]));
  for (const t of tasks) bySection.get(t.area_id)?.push(t);

  if (view === "list") {
    return (
      <TaskListView
        sections={sections}
        projects={projects}
        bySection={bySection}
        canManage={canManage}
      />
    );
  }

  return (
    <div className="-mx-4 min-h-0 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
      <div className="flex h-[calc(100vh-var(--topbar-height,58px)-16rem)] min-h-[560px] gap-4">
        {sections.map((section) => {
          const list = bySection.get(section.id) ?? [];
          return (
            <section key={section.id} className="group/col flex w-[300px] shrink-0 flex-col">
              <header className="flex shrink-0 items-center px-1 pb-2">
                <SectionHeading
                  id={section.id}
                  name={section.name}
                  count={list.length}
                  color={section.color}
                  canManage={canManage}
                />
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="flex flex-col gap-2">
                  {list.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      project={t.project_id ? projectById.get(t.project_id) : undefined}
                    />
                  ))}
                  <NewTaskForm
                    areas={sections}
                    projects={projects}
                    defaultAreaId={section.id}
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

        {canManage && (
          <div className="w-[260px] shrink-0 pt-0.5">
            <AddSection variant="board" />
          </div>
        )}
      </div>
    </div>
  );
}

const LIST_COLS = "grid-cols-[minmax(0,1fr)_11rem_7rem]";

function TaskListView({
  sections,
  projects,
  bySection,
  canManage,
}: {
  sections: Section[];
  projects: Project[];
  bySection: Map<string, Task[]>;
  canManage: boolean;
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

        {sections.map((section) => {
          const list = bySection.get(section.id) ?? [];
          return (
            <CollapsibleSection
              key={section.id}
              header={
                <SectionHeading
                  id={section.id}
                  name={section.name}
                  count={list.length}
                  color={section.color}
                  canManage={canManage}
                />
              }
            >
              {list.map((task) => (
                <TaskListRow key={task.id} task={task} />
              ))}
              <div className="border-t border-border/40 py-1 pl-[28px] pr-3">
                <NewTaskForm
                  areas={sections}
                  projects={projects}
                  defaultAreaId={section.id}
                  triggerLabel="Add task..."
                  triggerVariant="ghost"
                  triggerSize="sm"
                  triggerClassName="h-8 w-full justify-start px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                />
              </div>
            </CollapsibleSection>
          );
        })}

        {canManage && (
          <div className="px-3 py-3">
            <AddSection variant="list" />
          </div>
        )}
      </div>
    </div>
  );
}

function TaskListRow({ task }: { task: Task }) {
  const assignee = (task.assignees ?? []).find((a) => a.profile);
  const status = asTaskStatus(task.status);
  const done = status === "done";
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
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", statusDot(status))}
          title={TASK_STATUS_META[status].label}
        />
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
  return "bg-slate-400";
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
