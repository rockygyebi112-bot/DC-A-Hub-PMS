import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Kanban,
  Layers3,
  ListFilter,
  Milestone,
  Target,
  Timer,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FilterChips } from "@/components/admin/ui/filter-chips";
import { NewTaskForm } from "@/components/internal/new-task-form";
import { TaskBoard } from "@/components/internal/task-board";
import { asTaskStatus, type TaskStatus } from "@/components/internal/task-meta";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listAreas, listTasks } from "@/lib/internal/queries";
import { listWorkspaceProjects } from "@/lib/workspace/queries";
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
  const [areas, projects, tasks, allTasks] = await Promise.all([
    listAreas(),
    listWorkspaceProjects({ sort: "name" }).catch(() => []),
    listTasks({
      areaId: params.area,
      status: params.status,
      projectId: params.project,
    }),
    listTasks({ projectId: params.project }),
  ]);

  const areaOptions = areas.map((a) => ({ value: a.id, label: a.name }));
  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: p.client?.name ? `${p.name} - ${p.client.name}` : p.name,
  }));
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
  const projectCounts = projects.reduce<Record<string, number>>((acc, project) => {
    acc[project.id] = allTasks.filter((task) => task.project_id === project.id).length;
    return acc;
  }, {});

  const openTasks = allTasks.length - statusCounts.done;
  const overdueTasks = allTasks.filter(
    (task) => task.status !== "done" && task.due_date && task.due_date < todayIso(),
  ).length;
  const dueSoonTasks = allTasks.filter((task) => {
    if (task.status === "done" || !task.due_date) return false;
    return task.due_date >= todayIso() && task.due_date <= daysFromNowIso(7);
  }).length;
  const urgentTasks = allTasks.filter(
    (task) => task.status !== "done" && task.priority === "urgent",
  ).length;
  const unassignedTasks = allTasks.filter((task) => (task.assignees ?? []).length === 0).length;
  const completionRate =
    allTasks.length === 0 ? 0 : Math.round((statusCounts.done / allTasks.length) * 100);
  const focusRate =
    openTasks === 0
      ? 100
      : Math.round((statusCounts.in_progress / Math.max(openTasks, 1)) * 100);
  const activeFilters =
    Number(Boolean(params.status)) + Number(Boolean(params.area)) + Number(Boolean(params.project));
  const selectedProject = projects.find((project) => project.id === params.project);
  const selectedArea = areas.find((area) => area.id === params.area);
  const areaSummaries = areas
    .map((area) => {
      const areaTasks = allTasks.filter((task) => task.area_id === area.id);
      const done = areaTasks.filter((task) => asTaskStatus(task.status) === "done").length;
      const blocked = areaTasks.filter((task) => asTaskStatus(task.status) === "blocked").length;
      const overdue = areaTasks.filter(
        (task) => task.status !== "done" && task.due_date && task.due_date < todayIso(),
      ).length;
      return {
        id: area.id,
        name: area.name,
        color: area.color,
        total: areaTasks.length,
        done,
        open: areaTasks.length - done,
        blocked,
        overdue,
        rate: areaTasks.length === 0 ? 0 : Math.round((done / areaTasks.length) * 100),
      };
    })
    .sort((a, b) => b.open - a.open || b.total - a.total)
    .slice(0, 6);

  return (
    <div className="flex min-h-[calc(100vh-var(--topbar-height,58px)-3rem)] flex-col gap-4">
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border bg-background/70 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Kanban className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                      Internal command center
                    </h1>
                    <Badge variant={openTasks > 0 ? "info" : "success"} dot>
                      {openTasks} open
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                    A professional operating board for DC&A Hub tasks, deadlines,
                    owners, project links, blockers, and workstream health.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <WorkspaceScope
                  icon={BriefcaseBusiness}
                  label={selectedProject?.name ?? "All projects"}
                />
                <WorkspaceScope icon={Layers3} label={selectedArea?.name ?? "All workstreams"} />
                <WorkspaceScope icon={ArrowDownUp} label={`${activeFilters} active filters`} />
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <BoardStat icon={Target} label="Completion" value={`${completionRate}%`} />
              <BoardStat icon={Timer} label="Focus" value={`${focusRate}%`} />
              <NewTaskForm areas={areas} projects={projects} />
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-5">
          <WorkspaceMetric
            icon={ClipboardList}
            label="Total tasks"
            value={allTasks.length}
            detail={`${tasks.length} visible now`}
          />
          <WorkspaceMetric
            icon={Timer}
            label="In progress"
            value={statusCounts.in_progress}
            detail={`${statusCounts.not_started} queued`}
            tone="blue"
          />
          <WorkspaceMetric
            icon={TriangleAlert}
            label="Blocked"
            value={statusCounts.blocked}
            detail="Needs escalation"
            tone={statusCounts.blocked > 0 ? "red" : "neutral"}
          />
          <WorkspaceMetric
            icon={CalendarDays}
            label="Due soon"
            value={dueSoonTasks}
            detail={`${overdueTasks} overdue`}
            tone={overdueTasks > 0 ? "amber" : "green"}
          />
          <WorkspaceMetric
            icon={Users}
            label="Unassigned"
            value={unassignedTasks}
            detail="No owner listed"
            tone={unassignedTasks > 0 ? "amber" : "green"}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[18rem_1fr]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card">
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <ListFilter className="size-4 text-muted-foreground" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Workspace filters</h2>
                <p className="text-xs text-muted-foreground">
                  Scope the board by project, workstream, or status.
                </p>
              </div>
            </header>
            <div className="space-y-4 p-4">
              <FilterBlock label="Status">
                <FilterChips
                  paramName="status"
                  options={STATUS_FILTERS}
                  allLabel="All statuses"
                  counts={statusCounts}
                />
              </FilterBlock>
              {projectOptions.length > 0 && (
                <FilterBlock label="Project">
                  <FilterChips
                    paramName="project"
                    options={projectOptions}
                    allLabel="All projects"
                    counts={projectCounts}
                  />
                </FilterBlock>
              )}
              <FilterBlock label="Workstream">
                <FilterChips
                  paramName="area"
                  options={areaOptions}
                  allLabel="All workstreams"
                  counts={areaCounts}
                />
              </FilterBlock>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Milestone className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Workstream health</h2>
              </div>
              <Badge variant={urgentTasks > 0 ? "destructive" : "neutral"}>
                {urgentTasks} urgent
              </Badge>
            </header>
            <div className="space-y-3 p-4">
              {areaSummaries.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                  Create workstreams to organize internal work.
                </p>
              ) : (
                areaSummaries.map((area) => <WorkstreamRow key={area.id} area={area} />)
              )}
            </div>
          </div>
        </aside>

        <TaskBoard tasks={tasks} areas={areas} projects={projects} />
      </section>
    </div>
  );
}

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate(),
  ).padStart(2, "0")}`;
}

function daysFromNowIso(days: number): string {
  const t = new Date();
  t.setDate(t.getDate() + days);
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
  value: number | string;
  danger?: boolean;
}) {
  return (
    <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-2 sm:flex">
      <Icon className={cn("size-3.5 text-muted-foreground", danger && Number(value) > 0 && "text-destructive")} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function WorkspaceScope({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1">
      <Icon className="size-3.5" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function WorkspaceMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
}) {
  return (
    <div className="min-w-0 bg-card px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
        </div>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            tone === "neutral" && "bg-muted text-muted-foreground",
            tone === "blue" && "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300",
            tone === "green" &&
              "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
            tone === "amber" &&
              "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
            tone === "red" && "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

function FilterBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function WorkstreamRow({
  area,
}: {
  area: {
    name: string;
    color?: string | null;
    total: number;
    open: number;
    blocked: number;
    overdue: number;
    rate: number;
  };
}) {
  const alertCount = area.blocked + area.overdue;
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full bg-muted-foreground/60"
          style={area.color ? { backgroundColor: area.color } : undefined}
        />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{area.name}</p>
        <span className="text-xs tabular-nums text-muted-foreground">{area.rate}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(area.rate, area.total > 0 ? 5 : 0)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{area.open} open</span>
        <span className={cn("inline-flex items-center gap-1", alertCount > 0 && "text-destructive")}>
          {alertCount > 0 && <AlertTriangle className="size-3" />}
          {alertCount} alerts
        </span>
      </div>
    </div>
  );
}
