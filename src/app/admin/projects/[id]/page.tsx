import { notFound } from "next/navigation";
import {
  WorkspaceView,
  type WVMilestone,
  type WVPhase,
  type WVUpdate,
} from "@/components/admin/project-detail/workspace-view";
import {
  daysBetween,
  formatRelative,
  ProjectTabs,
  type Milestone,
} from "@/components/admin/project-detail/parts";
import { getProject } from "@/lib/admin/queries";
import { getBudgetSummary } from "@/lib/admin/queries/budget";
import { listProjectPhases, listProjectTeam } from "@/lib/workspace/queries";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const projectMaybe = await getProject(id);
  if (!projectMaybe) notFound();
  const project = projectMaybe;

  const [phases, team, budgetSummary] = await Promise.all([
    listProjectPhases(id),
    listProjectTeam(id),
    getBudgetSummary(id),
  ]);

  // Aggregate counts
  const allActivities = phases.flatMap((p) =>
    p.activities.map((a) => ({ ...a, phaseName: p.name })),
  );
  const totalActivities = allActivities.length;
  const doneActivities = allActivities.filter((a) => a.status === "done").length;
  const percent =
    totalActivities === 0
      ? 0
      : Math.round((doneActivities / totalActivities) * 100);

  // Health derivation
  const today = new Date();
  const endDate = project.end_date ? new Date(project.end_date) : null;
  const startDate = project.start_date ? new Date(project.start_date) : null;
  const remainingDays = endDate ? daysBetween(today, endDate) : null;
  const elapsedRatio =
    startDate && endDate && endDate > startDate
      ? Math.min(
          1,
          Math.max(
            0,
            (today.getTime() - startDate.getTime()) /
              (endDate.getTime() - startDate.getTime()),
          ),
        )
      : null;
  const health: "on-track" | "at-risk" | "delayed" | "not-started" =
    project.status === "completed" || percent === 100
      ? "on-track"
      : totalActivities === 0
        ? "not-started"
        : remainingDays !== null && remainingDays < 0
          ? "delayed"
          : elapsedRatio !== null && percent / 100 < elapsedRatio - 0.15
            ? "at-risk"
            : "on-track";

  // Phases for workplan view
  const wvPhases: WVPhase[] = phases.map((p) => ({
    id: p.id,
    name: p.name,
    activities: p.activities.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      planned_date: a.planned_date,
      completed_date: a.completed_date,
      responsible: a.responsible,
      proofCount: a.proofCount,
      commentCount: 0,
      priority: "medium",
      updatedAt: a.completed_date ?? a.planned_date ?? null,
    })),
  }));

  // Team
  const teamUsers = team
    .map((t) =>
      t.profile
        ? {
            name: t.profile.full_name,
            email: t.profile.email,
            avatarUrl: null,
          }
        : null,
    )
    .filter((u): u is { name: string; email: string; avatarUrl: null } => u !== null);

  const manager = team.find(
    (t) => t.profile?.role === "admin" || t.profile?.role === "staff",
  );

  // Upcoming milestones (top 5 future / not done activities by planned date)
  const futureActivities = allActivities
    .filter((a) => a.status !== "done" && a.planned_date)
    .sort((a, b) =>
      (a.planned_date ?? "").localeCompare(b.planned_date ?? ""),
    );
  const milestones: WVMilestone[] = futureActivities.slice(0, 5).map((a) => {
    const d = new Date(a.planned_date as string);
    return {
      id: a.id,
      title: a.name,
      date: a.planned_date as string,
      daysFromNow: daysBetween(today, d),
    };
  });
  const upcomingDeadlines = milestones.slice(0, 3);

  // Richer milestone cards: include phase name + per-activity health
  const nextMilestones: Milestone[] = futureActivities.slice(0, 6).map((a) => {
    const d = new Date(a.planned_date as string);
    const days = daysBetween(today, d);
    const mHealth: Milestone["health"] =
      days < 0
        ? "delayed"
        : a.status === "not_started" && days <= 0
          ? "at-risk"
          : days <= 7
            ? "at-risk"
            : "on-track";
    return {
      id: a.id,
      title: a.name,
      date: d,
      phase: a.phaseName,
      health: mHealth,
    };
  });

  // Overdue / due-this-week counts
  const sevenDays = 7;
  const overdueCount = allActivities.filter((a) => {
    if (a.status === "done" || !a.planned_date) return false;
    return daysBetween(today, new Date(a.planned_date)) < 0;
  }).length;
  const dueThisWeek = allActivities.filter((a) => {
    if (a.status === "done" || !a.planned_date) return false;
    const d = daysBetween(today, new Date(a.planned_date));
    return d >= 0 && d <= sevenDays;
  }).length;

  // Recent updates: most recently completed activities
  const recentUpdates: WVUpdate[] = allActivities
    .filter((a) => a.completed_date)
    .sort((a, b) =>
      (b.completed_date ?? "").localeCompare(a.completed_date ?? ""),
    )
    .slice(0, 4)
    .map((a) => ({
      id: a.id,
      text: a.name,
      actor: a.responsible ?? manager?.profile?.full_name ?? "Project team",
      when: formatRelative(a.completed_date),
      tone: "green" as const,
    }));

  return (
    <div className="space-y-6">
      <ProjectTabs projectId={id} active="overview" />
      <WorkspaceView
      projectId={id}
      projectName={project.name}
      projectCode={project.code}
      status={
        project.archived_at
          ? "archived"
          : (project.status as
              | "planning"
              | "active"
              | "paused"
              | "completed")
      }
      clientName={project.client?.name ?? null}
      clientId={project.client?.id ?? null}
      startDate={project.start_date}
      endDate={project.end_date}
      remainingDays={remainingDays}
      updatedAt={project.updated_at ?? null}
      managerName={manager?.profile?.full_name ?? null}
      managerEmail={manager?.profile?.email ?? null}
      doneCount={doneActivities}
      totalCount={totalActivities}
      health={health}
      phases={wvPhases}
      team={teamUsers}
      budget={{
        hasBudget: budgetSummary.hasBudget,
        total: budgetSummary.total,
        spent: budgetSummary.spent,
        currency: budgetSummary.currency,
      }}
      milestones={milestones}
      nextMilestones={nextMilestones}
      now={today.getTime()}
      upcomingDeadlines={upcomingDeadlines}
      recentUpdates={recentUpdates}
      overdueCount={overdueCount}
      dueThisWeek={dueThisWeek}
    />
    </div>
  );
}
