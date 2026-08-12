import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Archive, Kanban, LayoutList, type LucideIcon } from "lucide-react";

import { FilterChips } from "@/components/admin/ui/filter-chips";
import { TaskBoard } from "@/components/internal/task-board";
import {
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  asTaskStatus,
} from "@/components/internal/task-meta";
import { cn } from "@/lib/utils";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listAreas, listTasks } from "@/lib/internal/queries";
import { listWorkspaceProjects } from "@/lib/workspace/queries";

type PageParams = {
  area?: string;
  status?: string;
  project?: string;
  view?: string;
  archived?: string;
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
  const view = params.view === "board" ? "board" : "list";
  const showArchived = params.archived === "1";
  const [areas, projects, tasks, allTasks] = await Promise.all([
    listAreas({ includeArchived: showArchived }),
    listWorkspaceProjects({ sort: "name" }).catch(() => []),
    listTasks({
      areaId: params.area,
      status: params.status,
      projectId: params.project,
      includeArchived: showArchived,
    }),
    listTasks({ projectId: params.project }),
  ]);

  // Both staff and admin can manage sections (create/rename/reorder) once
  // migration 0047 opens the write policy. The page is already gated to those
  // two roles, so everyone who reaches it can manage. Archiving is the
  // exception: it cascades to every task in the section, so it is admin-only.
  const canManageSections = true;
  const canArchiveSections = profile.role === "admin";
  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: p.client?.name ? `${p.name} - ${p.client.name}` : p.name,
  }));
  const projectCounts = projects.reduce<Record<string, number>>((acc, project) => {
    acc[project.id] = allTasks.filter((task) => task.project_id === project.id).length;
    return acc;
  }, {});
  const linkedProjectOptions = projectOptions.filter(
    (project) => (projectCounts[project.value] ?? 0) > 0,
  );

  const statusOptions = TASK_STATUS_ORDER.map((status) => ({
    value: status,
    label: TASK_STATUS_META[status].label,
  }));
  const statusCounts = TASK_STATUS_ORDER.reduce<Record<string, number>>((acc, status) => {
    acc[status] = allTasks.filter((task) => asTaskStatus(task.status) === status).length;
    return acc;
  }, {});

  return (
    <div className="flex min-h-[calc(100vh-var(--topbar-height,58px)-3rem)] flex-col gap-4">
      <header className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border border-border/70 bg-card p-0.5">
          <ViewLink params={params} view="list" active={view === "list"} icon={LayoutList}>
            List
          </ViewLink>
          <ViewLink params={params} view="board" active={view === "board"} icon={Kanban}>
            Board
          </ViewLink>
        </div>

        <Link
          href={hrefFor(params, { archived: showArchived ? undefined : "1" })}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
            showArchived
              ? "border-border bg-muted text-foreground"
              : "border-border/70 bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <Archive className="size-3.5" />
          {showArchived ? "Hide archived" : "Show archived"}
        </Link>
      </header>

      <div className="flex flex-col gap-2 border-b border-border/70 pb-4">
        <FilterChips
          paramName="status"
          options={statusOptions}
          allLabel="All tasks"
          counts={statusCounts}
        />
        {linkedProjectOptions.length > 0 && (
          <FilterChips
            paramName="project"
            options={linkedProjectOptions}
            allLabel="All projects"
            counts={projectCounts}
          />
        )}
      </div>

      <TaskBoard
        tasks={tasks}
        sections={areas}
        projects={projects}
        view={view}
        canManage={canManageSections}
        isAdmin={canArchiveSections}
      />
    </div>
  );
}

function hrefFor(params: PageParams, updates: Partial<PageParams>) {
  const next = new URLSearchParams();
  for (const key of ["area", "status", "project", "view", "archived"] as const) {
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
