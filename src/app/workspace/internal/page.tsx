import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Kanban, LayoutList, type LucideIcon } from "lucide-react";

import { FilterChips } from "@/components/admin/ui/filter-chips";
import { NewTaskForm } from "@/components/internal/new-task-form";
import { TaskBoard } from "@/components/internal/task-board";
import { asTaskStatus } from "@/components/internal/task-meta";
import { cn } from "@/lib/utils";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listAreas, listTasks } from "@/lib/internal/queries";
import { listWorkspaceProjects } from "@/lib/workspace/queries";

type PageParams = {
  area?: string;
  status?: string;
  project?: string;
  view?: string;
};

export default async function InternalWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<PageParams>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/");
  }

  const params = await searchParams;
  const view = params.view === "list" ? "list" : "board";
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
  const areaCounts = areas.reduce<Record<string, number>>((acc, area) => {
    acc[area.id] = allTasks.filter((task) => task.area_id === area.id).length;
    return acc;
  }, {});
  const projectCounts = projects.reduce<Record<string, number>>((acc, project) => {
    acc[project.id] = allTasks.filter((task) => task.project_id === project.id).length;
    return acc;
  }, {});
  const linkedProjectOptions = projectOptions.filter(
    (project) => (projectCounts[project.value] ?? 0) > 0,
  );

  const doneTasks = allTasks.filter((task) => asTaskStatus(task.status) === "done").length;
  const openTasks = allTasks.length - doneTasks;

  return (
    <div className="flex min-h-[calc(100vh-var(--topbar-height,58px)-3rem)] flex-col gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#5B6AF0] text-white">
            <Kanban className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-gray-950">Internal Workspace</h1>
            <p className="text-xs text-muted-foreground">
              {openTasks} open · {allTasks.length} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border/70 bg-white p-0.5">
            <ViewLink params={params} view="board" active={view === "board"} icon={Kanban}>
              Board
            </ViewLink>
            <ViewLink params={params} view="list" active={view === "list"} icon={LayoutList}>
              List
            </ViewLink>
          </div>
          <NewTaskForm areas={areas} projects={projects} />
        </div>
      </header>

      {(areaOptions.length > 0 || linkedProjectOptions.length > 0) && (
        <div className="flex flex-col gap-2 border-b border-border/70 pb-4">
          {areaOptions.length > 0 && (
            <FilterChips
              paramName="area"
              options={areaOptions}
              allLabel="All workstreams"
              counts={areaCounts}
            />
          )}
          {linkedProjectOptions.length > 0 && (
            <FilterChips
              paramName="project"
              options={linkedProjectOptions}
              allLabel="All projects"
              counts={projectCounts}
            />
          )}
        </div>
      )}

      <TaskBoard tasks={tasks} areas={areas} projects={projects} view={view} />
    </div>
  );
}

function hrefFor(params: PageParams, updates: Partial<PageParams>) {
  const next = new URLSearchParams();
  for (const key of ["area", "status", "project", "view"] as const) {
    const resolved = Object.prototype.hasOwnProperty.call(updates, key) ? updates[key] : params[key];
    if (resolved) next.set(key, resolved);
  }
  const qs = next.toString();
  return qs ? `/workspace/internal?${qs}` : "/workspace/internal";
}

function ViewLink({
  params,
  view,
  active,
  icon: Icon,
  children,
}: {
  params: PageParams;
  view: "board" | "list";
  active: boolean;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Link
      href={hrefFor(params, { view })}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </Link>
  );
}
