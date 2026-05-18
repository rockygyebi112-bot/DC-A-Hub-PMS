import { Suspense } from "react";
import {
  Activity,
  FolderKanban,
  Users,
} from "lucide-react";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import {
  TasksOverview,
  type TaskRow,
  type TasksByFilter,
} from "@/components/admin/dashboard/tasks-overview";
import {
  ProjectHealthSummary,
  type HealthBucket,
} from "@/components/admin/dashboard/project-health-summary";
import {
  RecentProjectsList,
  type RecentProjectRow,
} from "@/components/admin/dashboard/recent-projects-list";
import {
  UpcomingMilestonesTimeline,
  type MilestoneRow,
} from "@/components/admin/dashboard/upcoming-milestones-timeline";
import {
  ActivityFeedCard,
  type ActivityFeedRow,
} from "@/components/admin/dashboard/activity-feed-card";
import { getAdminCounts } from "@/lib/admin/queries";
import { createClient } from "@/lib/supabase/server";
import { actionVerb } from "@/lib/notifications/labels";
import type { DashboardPeriod } from "@/components/admin/ui/dashboard-period-selector";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProjectRow = {
  id: string;
  name: string;
  code: string;
  status: "planning" | "active" | "paused" | "completed";
  start_date: string | null;
  end_date: string | null;
  archived_at: string | null;
  client: { name: string; logo_url: string | null } | null;
};

type ActivityRow = {
  id: string;
  phase_id: string;
  name: string;
  status: "not_started" | "in_progress" | "done";
  planned_date: string | null;
  completed_date: string | null;
};

type DashboardGridData = {
  health: {
    on_track: number;
    at_risk: number;
    delayed: number;
    not_started: number;
  };
  tasks: {
    byFilter: TasksByFilter;
    counts: { all: number; overdue: number; due_week: number; completed: number };
  };
  recentProjects: RecentProjectRow[];
  milestones: MilestoneRow[];
};

// ---------------------------------------------------------------------------
// Visual mapping helpers (deterministic by name → palette/icon)
// ---------------------------------------------------------------------------

const PROJECT_ACCENTS: RecentProjectRow["accent"][] = [
  "green",
  "blue",
  "amber",
  "cyan",
  "purple",
];

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function visualForProject(name: string) {
  const h = hashString(name);
  return {
    accent: PROJECT_ACCENTS[h % PROJECT_ACCENTS.length],
  };
}

function categoryFor(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("irrig") || lower.includes("water")) return "Infrastructure Development";
  if (lower.includes("livestock") || lower.includes("disease") || lower.includes("health"))
    return "Health & Livestock";
  if (lower.includes("fish") || lower.includes("blue")) return "Blue Economy";
  if (lower.includes("extension") || lower.includes("training") || lower.includes("capacity"))
    return "Capacity Building";
  if (lower.includes("climate") || lower.includes("research")) return "Research & Innovation";
  return "Programme Delivery";
}

function priorityFromName(name: string): TaskRow["priority"] {
  const h = hashString(name) % 3;
  return h === 0 ? "high" : h === 1 ? "medium" : "low";
}

function classifyHealth(
  project: ProjectRow,
  today: string,
): keyof DashboardGridData["health"] {
  if (project.status === "planning") return "not_started";
  if (project.status === "paused") return "at_risk";
  if (project.status === "completed") return "on_track";
  // active
  if (project.end_date && project.end_date < today) return "delayed";
  return "on_track";
}

function activityCompletion(activities: ActivityRow[]) {
  if (activities.length === 0) return 0;
  const done = activities.filter((a) => a.status === "done").length;
  return Math.round((done / activities.length) * 100);
}

function periodStartDate(period: DashboardPeriod, now = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth();
  let start: Date;
  if (period === "ytd") {
    start = new Date(y, 0, 1);
  } else if (period === "quarter") {
    const qStartMonth = Math.floor(m / 3) * 3;
    start = new Date(y, qStartMonth, 1);
  } else {
    // default: this month
    start = new Date(y, m, 1);
  }
  return start.toISOString();
}

// ---------------------------------------------------------------------------
// Data loaders — split into independent fetches so per-card Suspense
// boundaries can stream in as each one resolves rather than blocking on the
// slowest single query.
// ---------------------------------------------------------------------------

async function getDashboardGridData(
  period: DashboardPeriod,
): Promise<DashboardGridData> {
  const sb = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const periodStart = periodStartDate(period);

  const { data: projectsRaw } = await sb
    .from("projects")
    .select(
      "id, name, code, status, start_date, end_date, archived_at, client:clients(name, logo_url)",
    )
    .is("archived_at", null)
    .gte("created_at", periodStart)
    .order("created_at", { ascending: false });

  const projects = (projectsRaw ?? []) as ProjectRow[];
  const projectIds = projects.map((p) => p.id);

  type ActivityWithPhase = ActivityRow & { phases: { project_id: string } | null };
  const { data: activitiesRaw } = projectIds.length
    ? await sb
        .from("activities")
        .select(
          "id, phase_id, name, status, planned_date, completed_date, created_at, phases!inner(project_id)",
        )
        .in("phases.project_id", projectIds)
        .gte("created_at", periodStart)
    : { data: [] as ActivityWithPhase[] };
  const activitiesWithPhase = (activitiesRaw ?? []) as unknown as ActivityWithPhase[];
  const activities: ActivityRow[] = activitiesWithPhase.map(
    ({ phases: _phases, ...rest }) => rest,
  );
  const phaseToProject = new Map(
    activitiesWithPhase
      .filter((a) => a.phases?.project_id)
      .map((a) => [a.phase_id, a.phases!.project_id]),
  );

  const byProject = new Map<string, ActivityRow[]>();
  for (const a of activities) {
    const projectId = phaseToProject.get(a.phase_id);
    if (!projectId) continue;
    const list = byProject.get(projectId) ?? [];
    list.push(a);
    byProject.set(projectId, list);
  }

  const health = { on_track: 0, at_risk: 0, delayed: 0, not_started: 0 };
  for (const p of projects) health[classifyHealth(p, today)] += 1;

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const taskCandidates = activities
    .map((a) => {
      const projectId = phaseToProject.get(a.phase_id) ?? "";
      const project = projectById.get(projectId);
      return { activity: a, project };
    })
    .filter((row): row is { activity: ActivityRow; project: ProjectRow } => !!row.project);

  const overdueRows = taskCandidates.filter(
    (r) => r.activity.status !== "done" && r.activity.planned_date && r.activity.planned_date < today,
  );
  const dueWeekRows = taskCandidates.filter(
    (r) =>
      r.activity.status !== "done" &&
      r.activity.planned_date &&
      r.activity.planned_date >= today &&
      r.activity.planned_date <= inSevenDays,
  );
  const completedRows = taskCandidates.filter((r) => r.activity.status === "done");
  const allOpenRows = taskCandidates.filter((r) => r.activity.status !== "done");

  function toTaskRow(
    row: { activity: ActivityRow; project: ProjectRow },
    isCompleted: boolean,
  ): TaskRow {
    return {
      id: row.activity.id,
      title: row.activity.name,
      projectName: row.project.name,
      projectId: row.project.id,
      priority: priorityFromName(row.activity.name),
      dueDate: row.activity.planned_date,
      isCompleted,
      isOverdue:
        !isCompleted && !!row.activity.planned_date && row.activity.planned_date < today,
    };
  }

  const DISPLAY_LIMIT = 10;
  const overdueSorted = [...overdueRows].sort((a, b) =>
    (a.activity.planned_date ?? "").localeCompare(b.activity.planned_date ?? ""),
  );
  const dueWeekSorted = [...dueWeekRows].sort((a, b) =>
    (a.activity.planned_date ?? "").localeCompare(b.activity.planned_date ?? ""),
  );
  const completedSorted = [...completedRows].sort((a, b) =>
    (b.activity.completed_date ?? "").localeCompare(a.activity.completed_date ?? ""),
  );

  const allSeen = new Set<string>();
  const allList: TaskRow[] = [];
  function pushAll(row: { activity: ActivityRow; project: ProjectRow }, done: boolean) {
    if (allSeen.has(row.activity.id)) return;
    if (allList.length >= DISPLAY_LIMIT) return;
    allSeen.add(row.activity.id);
    allList.push(toTaskRow(row, done));
  }
  for (const r of overdueSorted) pushAll(r, false);
  for (const r of dueWeekSorted) pushAll(r, false);
  for (const r of allOpenRows) pushAll(r, false);
  for (const r of completedSorted) pushAll(r, true);

  const tasksByFilter: TasksByFilter = {
    all: allList,
    overdue: overdueSorted.slice(0, DISPLAY_LIMIT).map((r) => toTaskRow(r, false)),
    due_week: dueWeekSorted.slice(0, DISPLAY_LIMIT).map((r) => toTaskRow(r, false)),
    completed: completedSorted.slice(0, DISPLAY_LIMIT).map((r) => toTaskRow(r, true)),
  };

  const taskCounts = {
    all: allOpenRows.length + completedRows.length,
    overdue: overdueRows.length,
    due_week: dueWeekRows.length,
    completed: completedRows.length,
  };

  const recentProjects: RecentProjectRow[] = projects.slice(0, 5).map((p) => {
    const visual = visualForProject(p.name);
    const completion = activityCompletion(byProject.get(p.id) ?? []);
    return {
      id: p.id,
      name: p.name,
      category: categoryFor(p.name),
      progress: completion,
      health: classifyHealth(p, today),
      clientName: p.client?.name ?? null,
      clientLogoUrl: p.client?.logo_url ?? null,
      accent: visual.accent,
    };
  });

  const milestones: MilestoneRow[] = activities
    .filter((a) => a.status !== "done" && a.planned_date && a.planned_date >= today)
    .sort((a, b) => (a.planned_date ?? "").localeCompare(b.planned_date ?? ""))
    .slice(0, 4)
    .map((a) => {
      const projectId = phaseToProject.get(a.phase_id) ?? "";
      const project = projectById.get(projectId);
      const status: MilestoneRow["status"] = project
        ? classifyHealth(project, today)
        : "not_started";
      return {
        id: a.id,
        name: a.name,
        projectName: project?.name ?? "Project",
        date: a.planned_date as string,
        status,
        href: project ? `/workspace/projects/${project.id}/activities/${a.id}` : undefined,
      };
    });

  return {
    health,
    tasks: { byFilter: tasksByFilter, counts: taskCounts },
    recentProjects,
    milestones,
  };
}

async function getDashboardActivityFeed(): Promise<ActivityFeedRow[]> {
  const sb = await createClient();
  const { data: logRows } = await sb
    .from("activity_log")
    .select("id, action, created_at, project_id, actor_user_id")
    .order("created_at", { ascending: false })
    .limit(8);

  const rows = logRows ?? [];
  if (rows.length === 0) return [];

  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_user_id).filter(Boolean) as string[]),
  );
  const projectIds = Array.from(
    new Set(rows.map((r) => r.project_id).filter(Boolean) as string[]),
  );

  const [profilesRes, projectsRes] = await Promise.all([
    actorIds.length
      ? sb.from("profiles").select("user_id, full_name").in("user_id", actorIds)
      : Promise.resolve({ data: [] as { user_id: string; full_name: string }[] }),
    projectIds.length
      ? sb.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const actorById = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p.full_name]));
  const projNameById = new Map((projectsRes.data ?? []).map((p) => [p.id, p.name]));

  return rows.map((row) => {
    const actor = (row.actor_user_id && actorById.get(row.actor_user_id)) || "System";
    const projName = (row.project_id && projNameById.get(row.project_id)) || "a project";
    const verb = actionVerb(row.action);
    const message =
      row.action === "created"
        ? `created an entry on ${projName}`
        : row.action === "marked_done"
          ? `marked an activity done on ${projName}`
          : `${verb} ${projName}`;
    return {
      id: row.id,
      actorName: actor,
      message,
      createdAt: row.created_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const period: DashboardPeriod =
    sp.period === "quarter" || sp.period === "ytd" ? sp.period : "month";

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
      </div>

      {/* KPI strip — independent Suspense around the cheap admin_counts RPC,
          so the headline numbers paint as soon as that returns rather than
          waiting on the slower per-period grid below. */}
      <Suspense fallback={<KpiSkeleton />}>
        <KpiStrip />
      </Suspense>

      {/* Main grid — health + tasks + recent + milestones, all derived from
          one projects + activities snapshot scoped to the selected period. */}
      <Suspense key={`grid:${period}`} fallback={<GridSkeleton />}>
        <DashboardGrid period={period} />
      </Suspense>

      {/* Activity feed — its own Suspense + own query (activity_log + a small
          enrichment join). Independent of the period scope, so it doesn't
          re-fetch when the user flips the period selector. */}
      <Suspense fallback={<ActivityFeedSkeleton />}>
        <ActivityFeedSection />
      </Suspense>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-[92px] animate-pulse rounded-2xl border bg-muted/40"
        />
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div className="h-[280px] animate-pulse rounded-2xl border bg-muted/40" />
      <div className="h-[280px] animate-pulse rounded-2xl border bg-muted/40" />
    </div>
  );
}

function ActivityFeedSkeleton() {
  return <div className="h-[200px] animate-pulse rounded-2xl border bg-muted/40" />;
}

async function KpiStrip() {
  const counts = await getAdminCounts();
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      <KpiCard
        label="Total Projects"
        value={counts.totalProjects}
        icon={FolderKanban}
      />
      <KpiCard
        label="Active Projects"
        value={counts.activeProjects}
        icon={Activity}
      />
      <KpiCard
        label="Total Users"
        value={counts.totalUsers}
        icon={Users}
      />
    </div>
  );
}

async function DashboardGrid({ period }: { period: DashboardPeriod }) {
  const data = await getDashboardGridData(period);

  const healthBuckets: HealthBucket[] = [
    { key: "on_track", label: "On Track", value: data.health.on_track },
    { key: "at_risk", label: "At Risk", value: data.health.at_risk },
    { key: "delayed", label: "Delayed", value: data.health.delayed },
    { key: "not_started", label: "Not Started", value: data.health.not_started },
  ];

  const defaultTaskFilter = data.tasks.counts.overdue > 0 ? "overdue" : "all";

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <ProjectHealthSummary buckets={healthBuckets} />
        <TasksOverview
          tasksByFilter={data.tasks.byFilter}
          counts={data.tasks.counts}
          defaultFilter={defaultTaskFilter}
          viewAllHref="/admin/projects"
        />
      </div>
      <div className="space-y-5">
        <RecentProjectsList projects={data.recentProjects} viewAllHref="/admin/projects" />
        <UpcomingMilestonesTimeline
          milestones={data.milestones}
          viewAllHref="/admin/projects"
        />
      </div>
    </div>
  );
}

async function ActivityFeedSection() {
  const feed = await getDashboardActivityFeed();
  return <ActivityFeedCard items={feed} viewAllHref="/admin/projects" />;
}
