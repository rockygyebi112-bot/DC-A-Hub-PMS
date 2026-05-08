import Link from "next/link";
import {
  Activity,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  FolderKanban,
  Plus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatCard } from "@/components/admin/ui/stat-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { getAdminCounts, listRecentProjects } from "@/lib/admin/queries";
import { createClient } from "@/lib/supabase/server";

type FeedEntry = {
  id: string;
  action: string;
  created_at: string;
  projectName: string | null;
  actorName: string | null;
};

type UpcomingMilestone = {
  id: string;
  name: string;
  planned_date: string;
  projectId: string;
  projectName: string;
};

async function listRecentActivity(): Promise<FeedEntry[]> {
  const sb = await createClient();
  const { data: rows } = await sb
    .from("activity_log")
    .select("id, action, created_at, project_id, actor_user_id")
    .order("created_at", { ascending: false })
    .limit(8);

  if (!rows?.length) return [];

  const projectIds = Array.from(new Set(rows.map((row) => row.project_id).filter(Boolean)));
  const actorIds = Array.from(
    new Set(rows.map((row) => row.actor_user_id).filter(Boolean) as string[]),
  );

  const [projectsRes, profilesRes] = await Promise.all([
    projectIds.length
      ? sb.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    actorIds.length
      ? sb.from("profiles").select("user_id, full_name").in("user_id", actorIds)
      : Promise.resolve({ data: [] as { user_id: string; full_name: string }[] }),
  ]);

  const projectById = new Map((projectsRes.data ?? []).map((project) => [project.id, project.name]));
  const actorById = new Map((profilesRes.data ?? []).map((profile) => [profile.user_id, profile.full_name]));

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    created_at: row.created_at,
    projectName: row.project_id ? projectById.get(row.project_id) ?? null : null,
    actorName: row.actor_user_id ? actorById.get(row.actor_user_id) ?? null : null,
  }));
}

async function getOperationsSnapshot() {
  const sb = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: projects }, { count: proofCount }] = await Promise.all([
    sb
      .from("projects")
      .select("id, name, status")
      .is("archived_at", null)
      .order("name", { ascending: true }),
    sb.from("activity_proofs").select("*", { count: "exact", head: true }),
  ]);

  const projectRows = projects ?? [];
  const projectIds = projectRows.map((project) => project.id);
  const { data: phases } = projectIds.length
    ? await sb.from("phases").select("id, project_id").in("project_id", projectIds)
    : { data: [] };

  const phaseRows = phases ?? [];
  const phaseIds = phaseRows.map((phase) => phase.id);
  const { data: activities } = phaseIds.length
    ? await sb
        .from("activities")
        .select("id, phase_id, name, status, planned_date")
        .in("phase_id", phaseIds)
    : { data: [] };

  const phaseToProject = new Map(phaseRows.map((phase) => [phase.id, phase.project_id]));
  const projectById = new Map(projectRows.map((project) => [project.id, project.name]));
  const statusCounts = {
    planning: 0,
    active: 0,
    paused: 0,
    completed: 0,
  };
  for (const project of projectRows) {
    if (project.status in statusCounts) {
      statusCounts[project.status as keyof typeof statusCounts] += 1;
    }
  }

  const activityRows = activities ?? [];
  const doneActivities = activityRows.filter((activity) => activity.status === "done").length;
  const upcoming: UpcomingMilestone[] = activityRows
    .filter(
      (activity) =>
        activity.status !== "done" &&
        typeof activity.planned_date === "string" &&
        activity.planned_date >= today,
    )
    .sort((a, b) => (a.planned_date ?? "").localeCompare(b.planned_date ?? ""))
    .slice(0, 5)
    .map((activity) => {
      const projectId = phaseToProject.get(activity.phase_id) ?? "";
      return {
        id: activity.id,
        name: activity.name,
        planned_date: activity.planned_date!,
        projectId,
        projectName: projectById.get(projectId) ?? "Project",
      };
    });

  return {
    statusCounts,
    phaseCount: phaseRows.length,
    activityCount: activityRows.length,
    doneActivities,
    proofCount: proofCount ?? 0,
    completionRate:
      activityRows.length === 0 ? 0 : Math.round((doneActivities / activityRows.length) * 100),
    upcoming,
  };
}

export default async function AdminOverview() {
  const [counts, recentProjects, activity, snapshot] = await Promise.all([
    getAdminCounts(),
    listRecentProjects(6),
    listRecentActivity(),
    getOperationsSnapshot(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle="Portfolio, delivery, and access."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/admin/clients/new" />}>
              <Plus className="size-4" />
              Client
            </Button>
            <Button render={<Link href="/admin/projects/new" />}>
              <Plus className="size-4" />
              Project
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active clients"
          value={counts.activeClients}
          href="/admin/clients"
          hint="Client organizations"
          icon={Building2}
        />
        <StatCard
          label="Active projects"
          value={counts.activeProjects}
          href="/admin/projects"
          hint="Open project shells"
          icon={FolderKanban}
        />
        <StatCard
          label="Completed activities"
          value={snapshot.doneActivities}
          href="/workspace"
          hint={`${snapshot.completionRate}% completion rate`}
          icon={CheckCircle2}
        />
        <StatCard
          label="Proof files"
          value={snapshot.proofCount}
          href="/workspace"
          hint="Stored evidence"
          icon={FileText}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr_1fr]">
        <SectionCard title="Portfolio Health">
          <div className="grid gap-3 sm:grid-cols-2">
            <HealthMetric
              label="Planning"
              value={snapshot.statusCounts.planning}
              status="planning"
            />
            <HealthMetric
              label="Active"
              value={snapshot.statusCounts.active}
              status="active"
            />
            <HealthMetric
              label="Paused"
              value={snapshot.statusCounts.paused}
              status="paused"
            />
            <HealthMetric
              label="Completed"
              value={snapshot.statusCounts.completed}
              status="completed"
            />
          </div>
        </SectionCard>

        <SectionCard title="Workplan">
          <div className="space-y-5">
            <div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-semibold tracking-tight">
                    {snapshot.completionRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">Activity completion</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{snapshot.doneActivities} done</p>
                  <p>{snapshot.activityCount} total</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${snapshot.completionRate}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SmallMetric label="Phases" value={snapshot.phaseCount} />
              <SmallMetric label="Activities" value={snapshot.activityCount} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Access"
          action={
            <Button variant="ghost" size="sm" render={<Link href="/admin/users" />}>
              Manage
            </Button>
          }
        >
          <div className="grid gap-3">
            <SmallMetric label="Active users" value={counts.totalUsers} icon={Users} />
            <SmallMetric label="New this week" value={counts.pendingInvites} icon={Activity} />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          title="Upcoming Milestones"
          action={<CalendarDays className="size-4 text-muted-foreground" />}
        >
          {snapshot.upcoming.length === 0 ? (
            <EmptyState
              title="No upcoming milestones"
              description="Scheduled activities will appear here."
              icon={CalendarDays}
            />
          ) : (
            <div className="space-y-2">
              {snapshot.upcoming.map((item) => (
                <Link
                  key={item.id}
                  href={`/workspace/projects/${item.projectId}/activities/${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.projectName}</p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {item.planned_date}
                  </time>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Projects"
          action={
            <Button variant="ghost" size="sm" render={<Link href="/admin/projects" />}>
              View all
            </Button>
          }
        >
          {recentProjects.length === 0 ? (
            <EmptyState
              title="No projects"
              description="Create a project to start tracking delivery."
              icon={FolderKanban}
            />
          ) : (
            <div className="space-y-2">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/admin/projects/${project.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">{project.code}</p>
                  </div>
                  <StatusPill
                    status={project.status as "planning" | "active" | "paused" | "completed"}
                  />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Activity"
          action={<Activity className="size-4 text-muted-foreground" />}
        >
          {activity.length === 0 ? (
            <EmptyState
              title="No activity"
              description="Project events will appear here."
              icon={Activity}
            />
          ) : (
            <ol className="space-y-3">
              {activity.map((row) => (
                <li key={row.id} className="flex gap-3 text-sm">
                  <span className="mt-1 size-2 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{formatAction(row.action)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.projectName ?? "Project"} by {row.actorName ?? "system"}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString()}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function HealthMetric({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: "planning" | "active" | "paused" | "completed";
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <StatusPill status={status} />
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon?: typeof Users;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 text-primary" />}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function formatAction(action: string) {
  return action.replaceAll("_", " ").replace(/^\w/, (match) => match.toUpperCase());
}
