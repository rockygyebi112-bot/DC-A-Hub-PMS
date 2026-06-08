import { redirect } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Kanban,
  ListFilter,
  Timer,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { FilterChips } from "@/components/admin/ui/filter-chips";
import { NewTaskForm } from "@/components/internal/new-task-form";
import { TaskBoard } from "@/components/internal/task-board";
import { asTaskStatus, type TaskStatus } from "@/components/internal/task-meta";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listAreas, listTasks } from "@/lib/internal/queries";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

export default async function InternalWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; status?: string; project?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/");
  }

  const params = await searchParams;
  const [areas, tasks, allTasks] = await Promise.all([
    listAreas(),
    listTasks({
      areaId: params.area,
      status: params.status,
      projectId: params.project,
    }),
    listTasks({ projectId: params.project }),
  ]);

  const areaOptions = areas.map((a) => ({ value: a.id, label: a.name }));
  const statusCounts = allTasks.reduce(
    (acc, task) => {
      acc[asTaskStatus(task.status)] += 1;
      return acc;
    },
    {
      not_started: 0,
      in_progress: 0,
      blocked: 0,
      done: 0,
    } satisfies Record<TaskStatus, number>,
  );
  const areaCounts = areas.reduce<Record<string, number>>((acc, area) => {
    acc[area.id] = allTasks.filter((task) => task.area_id === area.id).length;
    return acc;
  }, {});

  const openTasks = allTasks.length - statusCounts.done;
  const overdueTasks = allTasks.filter(
    (task) => task.status !== "done" && task.due_date && task.due_date < todayIso(),
  ).length;
  const activeFilters = Number(Boolean(params.status)) + Number(Boolean(params.area));

  return (
    <div className="flex min-h-[calc(100vh-var(--topbar-height,58px)-3rem)] flex-col gap-3">
      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-3 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Kanban className="size-4" />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate font-heading text-xl font-bold tracking-tight sm:text-2xl">
                    Internal workspace
                  </h1>
                  <p className="truncate text-xs text-muted-foreground sm:text-sm">
                    Team tasks, blockers, due dates, and ownership in one board.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <BoardStat icon={Circle} label="Open" value={openTasks} />
              <BoardStat icon={TriangleAlert} label="Overdue" value={overdueTasks} danger />
              <NewTaskForm areas={areas} />
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto pb-1">
              <ViewTab active icon={Kanban} label="Board" />
              <ViewTab icon={Timer} label={`${statusCounts.in_progress} in progress`} />
              <ViewTab icon={CheckCircle2} label={`${statusCounts.done} done`} />
              <ViewTab icon={CalendarDays} label={`${overdueTasks} overdue`} />
            </div>

            <div className="flex min-w-0 flex-col gap-2 xl:max-w-[56rem] xl:flex-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <ListFilter className="size-3.5" />
                Filters
                {activeFilters > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                    {activeFilters} active
                  </span>
                )}
              </div>
              <div className="grid min-w-0 gap-2 md:grid-cols-2">
                <FilterChips
                  paramName="status"
                  options={STATUS_FILTERS}
                  allLabel="All statuses"
                  counts={statusCounts}
                  wrap={false}
                />
                <FilterChips
                  paramName="area"
                  options={areaOptions}
                  allLabel="All areas"
                  counts={areaCounts}
                  wrap={false}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <TaskBoard tasks={tasks} areas={areas} />
    </div>
  );
}

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate(),
  ).padStart(2, "0")}`;
}

function BoardStat({
  icon: Icon,
  label,
  value,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="hidden items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 sm:flex">
      <Icon className={cn("size-3.5 text-muted-foreground", danger && value > 0 && "text-destructive")} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function ViewTab({
  icon: Icon,
  label,
  active,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}
