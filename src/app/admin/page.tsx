import { Suspense } from "react";
import {
  Activity,
  CheckCircle2,
  FolderKanban,
  Leaf,
  PauseCircle,
  Sprout,
  Tractor,
  Users,
  Waves,
  Wheat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { KpiCard } from "@/components/admin/dashboard/kpi-card";
import {
  ProjectOverviewDonut,
  type DonutSegment,
} from "@/components/admin/dashboard/project-overview-donut";
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
import {
  DashboardPeriodSelector,
  type DashboardPeriod,
} from "@/components/admin/ui/dashboard-period-selector";

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
};

type ActivityRow = {
  id: string;
  phase_id: string;
  name: string;
  status: "not_started" | "in_progress" | "done";
  planned_date: string | null;
  completed_date: string | null;
};

type DashboardData = {
  totals: {
    total: number;
    active: number;
    completed: number;
    paused: number;
    planning: number;
  };
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
  activity: ActivityFeedRow[];
};

// ---------------------------------------------------------------------------
// Visual mapping helpers (deterministic by name → palette/icon)
// ---------------------------------------------------------------------------

const PROJECT_ICONS: LucideIcon[] = [Sprout, Tractor, Waves, Leaf, Wheat, FolderKanban];
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
    icon: PROJECT_ICONS[h % PROJECT_ICONS.length],
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
): keyof DashboardData["health"] {
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

// ---------------------------------------------------------------------------
// Data loader
// ---------------------------------------------------------------------------

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

async function getDashboardData(
  period: DashboardPeriod = "month",
): Promise<DashboardData> {
  const sb = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const periodStart = periodStartDate(period);

  const [{ data: projectsRaw }, logRes] = await Promise.all([
    sb
      .from("projects")
      .select("id, name, code, status, start_date, end_date, archived_at")
      .is("archived_at", null)
      .gte("created_at", periodStart)
      .order("created_at", { ascending: false }),
    sb
      .from("activity_log")
      .select("id, action, created_at, project_id, actor_user_id")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const projects = (projectsRaw ?? []) as ProjectRow[];
  const projectIds = projects.map((p) => p.id);

  // Kick off the activity-log enrichment (profiles + project names) in
  // parallel with the activities query below — it only depends on logRes,
  // which we already have, so there's no reason to wait.
  const logRows = logRes.data ?? [];
  const actorIds = Array.from(
    new Set(logRows.map((r) => r.actor_user_id).filter(Boolean) as string[]),
  );
  const projectsForLog = Array.from(
    new Set(logRows.map((r) => r.project_id).filter(Boolean)),
  );
  const logEnrichmentPromise = Promise.all([
    actorIds.length
      ? sb.from("profiles").select("user_id, full_name").in("user_id", actorIds)
      : Promise.resolve({ data: [] as { user_id: string; full_name: string }[] }),
    projectsForLog.length
      ? sb.from("projects").select("id, name").in("id", projectsForLog)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  // Pull activities + their parent phase's project_id in a single round-trip
  // via PostgREST's embedded resource filter, instead of fetching phases first
  // and then activities (which adds an unnecessary serial hop).
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

  // Per-project activity grouping
  const byProject = new Map<string, ActivityRow[]>();
  for (const a of activities) {
    const projectId = phaseToProject.get(a.phase_id);
    if (!projectId) continue;
    const list = byProject.get(projectId) ?? [];
    list.push(a);
    byProject.set(projectId, list);
  }

  // Totals
  const totals = {
    total: projects.length,
    active: projects.filter((p) => p.status === "active").length,
    completed: projects.filter((p) => p.status === "completed").length,
    paused: projects.filter((p) => p.status === "paused").length,
    planning: projects.filter((p) => p.status === "planning").length,
  };

  // Health distribution
  const health = { on_track: 0, at_risk: 0, delayed: 0, not_started: 0 };
  for (const p of projects) health[classifyHealth(p, today)] += 1;

  // Tasks (mapped from activity rows that aren't done OR recently completed)
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

  // Build per-filter task lists so the filter pills actually swap between
  // disjoint row sets rather than all showing the same pre-picked handful.
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

  // "All" mixes overdue + due-this-week + other open + recently completed.
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

  // Recent projects with progress
  const recentProjects: RecentProjectRow[] = projects.slice(0, 5).map((p) => {
    const visual = visualForProject(p.name);
    const completion = activityCompletion(byProject.get(p.id) ?? []);
    return {
      id: p.id,
      name: p.name,
      category: categoryFor(p.name),
      progress: completion,
      health: classifyHealth(p, today),
      icon: visual.icon,
      accent: visual.accent,
    };
  });

  // Upcoming milestones — next-five activities in the future
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

  // Activity feed — enrichment was kicked off in parallel earlier.
  const [profilesRes, projectNamesRes] = await logEnrichmentPromise;
  const actorById = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p.full_name]));
  const projNameById = new Map((projectNamesRes.data ?? []).map((p) => [p.id, p.name]));

  const ACTION_VERB: Record<string, string> = {
    created: "created",
    updated: "updated",
    marked_done: "marked done on",
    proof_added: "added proof to",
    proof_deleted: "removed proof from",
  };
  const activityFeed: ActivityFeedRow[] = logRows.map((row) => {
    const actor = (row.actor_user_id && actorById.get(row.actor_user_id)) || "System";
    const projName = (row.project_id && projNameById.get(row.project_id)) || "a project";
    const verb = ACTION_VERB[row.action] ?? row.action.replaceAll("_", " ");
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

  return {
    totals,
    health,
    tasks: { byFilter: tasksByFilter, counts: taskCounts },
    recentProjects,
    milestones,
    activity: activityFeed,
  };
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
      {/* Shell renders immediately — period selector is interactive even
          while the data-heavy body below is still streaming. */}
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <DashboardPeriodSelector current={period} />
      </div>
      <Suspense
        key={period}
        fallback={<DashboardSkeleton />}
      >
        <DashboardBody period={period} />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  // Simple shimmer placeholders so the dashboard area doesn't pop in with a
  // jarring layout shift while the data resolves. Heights are tuned to roughly
  // match the real KPI row + cards so the page doesn't reflow when content
  // streams in.
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[92px] animate-pulse rounded-2xl border bg-muted/40"
          />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-[280px] animate-pulse rounded-2xl border bg-muted/40" />
        <div className="h-[280px] animate-pulse rounded-2xl border bg-muted/40" />
      </div>
    </div>
  );
}

async function DashboardBody({ period }: { period: DashboardPeriod }) {
  const [counts, data] = await Promise.all([
    getAdminCounts(),
    getDashboardData(period),
  ]);

  const donutSegments: DonutSegment[] = [
    { key: "on_track", label: "On Track", value: data.health.on_track },
    { key: "at_risk", label: "At Risk", value: data.health.at_risk },
    { key: "delayed", label: "Delayed", value: data.health.delayed },
    { key: "not_started", label: "Not Started", value: data.health.not_started },
  ];

  const healthBuckets: HealthBucket[] = [
    { key: "on_track", label: "On Track", value: data.health.on_track },
    { key: "at_risk", label: "At Risk", value: data.health.at_risk },
    { key: "delayed", label: "Delayed", value: data.health.delayed },
    { key: "not_started", label: "Not Started", value: data.health.not_started },
  ];

  return (
    <div className="space-y-5">
      {/* KPI summary row. 2 cols on phones so the section doesn't span a
          full scroll-screen; widens to 3/5 on larger surfaces. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total Projects"
          value={data.totals.total}
          icon={FolderKanban}
          accent="blue"
          delta={counts.deltas.totalProjects}
        />
        <KpiCard
          label="Active Projects"
          value={data.totals.active}
          icon={Activity}
          accent="green"
          delta={counts.deltas.activeProjects}
        />
        <KpiCard
          label="Completed Projects"
          value={data.totals.completed}
          icon={CheckCircle2}
          accent="purple"
          delta={counts.deltas.completedProjects}
        />
        <KpiCard
          label="On Hold Projects"
          value={data.totals.paused}
          icon={PauseCircle}
          accent="amber"
          delta={counts.deltas.pausedProjects}
        />
        <KpiCard
          label="Total Users"
          value={counts.totalUsers}
          icon={Users}
          accent="cyan"
          delta={counts.deltas.totalUsers}
        />
      </div>

      {/* Main 2-column grid */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Left column */}
        <div className="space-y-5">
          <ProjectOverviewDonut total={data.totals.total} segments={donutSegments} />
          <TasksOverview
            tasksByFilter={data.tasks.byFilter}
            counts={data.tasks.counts}
            viewAllHref="/admin/projects"
          />
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <RecentProjectsList projects={data.recentProjects} viewAllHref="/admin/projects" />
          <UpcomingMilestonesTimeline
            milestones={data.milestones}
            viewAllHref="/admin/projects"
          />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid gap-5 xl:grid-cols-2">
        <ProjectHealthSummary buckets={healthBuckets} />
        <ActivityFeedCard items={data.activity} viewAllHref="/admin/projects" />
      </div>

    </div>
  );
}
