import Link from "next/link";
import type { ComponentType } from "react";
import {
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  MoreHorizontal,
  PauseCircle,
  Plus,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectIcon } from "@/components/ui/project-icon";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { PriorityPill, type Priority } from "@/components/ui/priority-pill";
import { ProjectsToolbar } from "@/components/workspace/projects-toolbar";
import { ProjectProgress } from "@/components/workspace/project-progress";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listWorkspaceProjects } from "@/lib/workspace/queries";

function inferPriority(status: string, totalCount: number): Priority {
  if (status === "active") return "high";
  if (status === "paused") return "medium";
  if (totalCount === 0) return "low";
  return "medium";
}

function formatProjectDate(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default async function WorkspaceHome({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view ?? "list";
  const statusFilter = sp.status ?? "all";
  const sort = (sp.sort as "name" | "deadline" | "status" | "created" | undefined) ?? "created";

  // Two parallel queries:
  //  - `allProjects` powers the KPI counts at the top of the page and the
  //    "next deadline" callout, so it must be unfiltered.
  //  - `projects` is what the list/grid renders; the DB does the sort and
  //    status filter so we don't ship full rows to JS just to discard them.
  // When no status filter is active, both reuse the same in-render cache
  // entry — the only extra cost is the sort variant.
  const [profile, allProjects, projects] = await Promise.all([
    getCurrentProfile(),
    listWorkspaceProjects({ sort: "created" }),
    listWorkspaceProjects({ status: statusFilter, sort }),
  ]);

  const isAdmin = profile?.role === "admin";
  const activeCount = allProjects.filter((p) => p.status === "active").length;
  const completedCount = allProjects.filter((p) => p.status === "completed").length;
  const waitingCount = allProjects.filter((p) =>
    ["planning", "paused"].includes(p.status),
  ).length;
  const nextDeadline = allProjects
    .filter((p) => p.end_date && p.status !== "completed")
    .sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? ""))[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile?.fullName ?? "Workspace"} · {allProjects.length} projects assigned
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button variant="outline" render={<Link href="/admin/users" />}>
              <UserPlus className="size-4" />
              Invite
            </Button>
          )}
          {isAdmin && (
            <Button render={<Link href="/admin/projects/new" />}>
              <Plus className="size-4" />
              New Project
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <WorkspaceMetric
          icon={FolderKanban}
          label="Assigned"
          value={allProjects.length}
          hint={`${projects.length} visible with current filters`}
          tone="blue"
        />
        <WorkspaceMetric
          icon={CalendarClock}
          label="Active"
          value={activeCount}
          hint="Projects currently moving"
          tone="green"
        />
        <WorkspaceMetric
          icon={PauseCircle}
          label="Planning / paused"
          value={waitingCount}
          hint="Waiting on kickoff or restart"
          tone="amber"
        />
        <WorkspaceMetric
          icon={CheckCircle2}
          label="Completed"
          value={completedCount}
          hint={
            nextDeadline
              ? `Next due: ${formatProjectDate(nextDeadline.end_date)}`
              : "No upcoming deadlines"
          }
          tone="cyan"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="px-4 pt-4 md:px-6">
          <ProjectsToolbar total={projects.length} />
        </div>

        {projects.length === 0 ? (
          <div className="p-6">
            <EmptyState
              variant="page"
              icon={FolderKanban}
              title={statusFilter !== "all" ? "No projects match" : "No assigned projects"}
              description={
                statusFilter !== "all"
                  ? "Try a different status filter."
                  : "Ask an admin to add you to a project team."
              }
            />
          </div>
        ) : view === "cards" ? (
          <CardsView projects={projects} />
        ) : (
          <ListView projects={projects} />
        )}

        {projects.length > 0 && (
          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground md:px-6">
            <span>
              Showing 1–{projects.length} of {projects.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">1</span>
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ListView({ projects }: { projects: Awaited<ReturnType<typeof listWorkspaceProjects>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="w-10 px-4 py-2.5">
              <Checkbox disabled aria-label="Select all projects" />
            </th>
            <th className="px-2 py-2.5">Project Name</th>
            <th className="px-2 py-2.5">Start Date</th>
            <th className="px-2 py-2.5">Deadline</th>
            <th className="px-2 py-2.5">Status</th>
            <th className="px-2 py-2.5">Progress</th>
            <th className="px-2 py-2.5">Priority</th>
            <th className="w-10 px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-4 py-2.5">
                <Checkbox aria-label={`Select ${p.name}`} />
              </td>
              <td className="px-2 py-2.5">
                <Link href={`/workspace/projects/${p.id}`} className="flex items-center gap-2.5 group">
                  <ProjectIcon name={p.name} seed={p.id} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate font-medium group-hover:underline">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.client?.name ?? "No client"} · {p.code}
                    </div>
                  </div>
                </Link>
              </td>
              <td className="px-2 py-2.5 text-muted-foreground">
                {formatProjectDate(p.start_date)}
              </td>
              <td className="px-2 py-2.5 text-muted-foreground">
                {formatProjectDate(p.end_date)}
              </td>
              <td className="px-2 py-2.5">
                <StatusPill status={p.status as "planning" | "active" | "paused" | "completed"} />
              </td>
              <td className="px-2 py-2.5 min-w-[140px]">
                <ProjectProgress done={p.doneCount} total={p.totalCount} />
              </td>
              <td className="px-2 py-2.5">
                <PriorityPill priority={inferPriority(p.status, p.totalCount)} />
              </td>
              <td className="px-4 py-2.5 text-right">
                <Link
                  href={`/workspace/projects/${p.id}`}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardsView({ projects }: { projects: Awaited<ReturnType<typeof listWorkspaceProjects>> }) {
  return (
    <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6 xl:grid-cols-3">
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/workspace/projects/${p.id}`}
          className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/10 focus-ring"
        >
          <div className="flex items-start gap-3">
            <ProjectIcon name={p.name} seed={p.id} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate font-semibold group-hover:underline">{p.name}</p>
                <StatusPill status={p.status as "planning" | "active" | "paused" | "completed"} />
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {p.client?.name ?? "No client"} · {p.code}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <ProjectProgress done={p.doneCount} total={p.totalCount} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{p.end_date ? `Due ${formatProjectDate(p.end_date)}` : "No deadline"}</span>
            <PriorityPill priority={inferPriority(p.status, p.totalCount)} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function WorkspaceMetric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint: string;
  tone: "blue" | "green" | "amber" | "cyan";
}) {
  const toneClass = {
    blue: "kpi-tile-blue",
    green: "kpi-tile-green",
    amber: "kpi-tile-amber",
    cyan: "kpi-tile-cyan",
  }[tone];

  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className={`kpi-tile ${toneClass}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="stat-number mt-1 text-2xl">{value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
  );
}
