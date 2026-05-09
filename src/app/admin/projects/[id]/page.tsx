import Link from "next/link";
import {
  ArrowLeft,
  Download,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import { StatusPill } from "@/components/admin/ui/status-pill";
import {
  NextMilestonesCard,
  ProjectDetailsCard,
  ProjectTabs,
  RecentActivityCard,
  SummaryBudgetCard,
  SummaryClientCard,
  SummaryProgressCard,
  SummaryTeamCard,
  SummaryTimelineCard,
  SummaryWorkplanCard,
  WorkplanOverviewCard,
  daysBetween,
  formatRelative,
  type Milestone,
  type PhaseRow,
  type RecentActivityItem,
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
  const [project, phases, team, budgetSummary] = await Promise.all([
    getProject(id),
    listProjectPhases(id),
    listProjectTeam(id),
    getBudgetSummary(id),
  ]);

  // Aggregate counts
  const allActivities = phases.flatMap((p) => p.activities);
  const totalActivities = allActivities.length;
  const doneActivities = allActivities.filter((a) => a.status === "done").length;
  const percent =
    totalActivities === 0 ? 0 : Math.round((doneActivities / totalActivities) * 100);

  // Health derivation: based on schedule vs progress
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

  // Phase rows
  const phaseRows: PhaseRow[] = phases.map((p) => ({
    id: p.id,
    name: p.name,
    done: p.activities.filter((a) => a.status === "done").length,
    total: p.activities.length,
  }));

  // Team avatars
  const teamUsers = team
    .map((t) =>
      t.profile
        ? { name: t.profile.full_name, email: t.profile.email }
        : null,
    )
    .filter((u): u is { name: string; email: string } => u !== null);

  // Project manager guess: first staff/admin member
  const manager = team.find(
    (t) => t.profile?.role === "admin" || t.profile?.role === "staff",
  );

  // Recent activity (derived from activity status changes)
  const recentItems: RecentActivityItem[] = allActivities
    .filter((a) => a.completed_date || a.planned_date)
    .sort((a, b) => {
      const ad = a.completed_date ?? a.planned_date ?? "";
      const bd = b.completed_date ?? b.planned_date ?? "";
      return bd.localeCompare(ad);
    })
    .slice(0, 4)
    .map((a) => {
      const actor = a.responsible ?? manager?.profile?.full_name ?? "Project team";
      const verb =
        a.status === "done"
          ? "completed"
          : a.status === "in_progress"
            ? "is working on"
            : "scheduled";
      const tone: RecentActivityItem["tone"] =
        a.status === "done" ? "green" : a.status === "in_progress" ? "blue" : "gray";
      return {
        id: a.id,
        actorName: actor,
        actorEmail: actor.toLowerCase().replace(/\s+/g, ".") + "@dcahub.local",
        text: `${verb} ${a.name}`,
        when: formatRelative(a.completed_date ?? a.planned_date ?? null),
        tone,
      };
    });

  // Upcoming milestones: next planned (non-done) activities by planned_date
  const milestones: Milestone[] = allActivities
    .filter((a) => a.status !== "done" && a.planned_date)
    .sort((a, b) =>
      (a.planned_date ?? "").localeCompare(b.planned_date ?? ""),
    )
    .slice(0, 3)
    .map((a) => {
      const phase = phases.find((p) => p.id === a.phase_id);
      const date = new Date(a.planned_date as string);
      const days = daysBetween(today, date);
      const ms: Milestone = {
        id: a.id,
        date,
        title: a.name,
        phase: phase?.name ?? "—",
        health: days < 0 ? "delayed" : days < 7 ? "at-risk" : "on-track",
      };
      return ms;
    });

  return (
    <div className="space-y-6">
      {/* Project header */}
      <div className="space-y-4">
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to projects
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-[32px]">
                {project.name}
              </h1>
              <StatusPill
                status={
                  project.archived_at
                    ? "archived"
                    : (project.status as
                        | "planning"
                        | "active"
                        | "paused"
                        | "completed")
                }
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {project.code} / {project.client?.name ?? "No client"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              <Share2 className="size-3.5" />
              Share
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              <Download className="size-3.5" />
              Export
            </button>
            <Link
              href={`/admin/projects/${id}/edit`}
              className="inline-flex items-center justify-center rounded-md border border-border bg-background p-2 text-muted-foreground transition-colors hover:bg-muted"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ProjectTabs projectId={id} active="overview" />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryProgressCard
          done={doneActivities}
          total={totalActivities}
          health={health}
        />
        <SummaryTimelineCard
          startDate={project.start_date}
          endDate={project.end_date}
          remainingDays={remainingDays}
        />
        <SummaryWorkplanCard
          phases={phases.length}
          activities={totalActivities}
        />
        <SummaryBudgetCard
          total={budgetSummary.hasBudget ? budgetSummary.total : null}
          spent={budgetSummary.spent}
          currency={budgetSummary.currency}
          projectId={id}
        />
        <SummaryTeamCard members={teamUsers} projectId={id} />
        <SummaryClientCard
          clientName={project.client?.name ?? null}
          clientId={project.client?.id ?? null}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5 xl:col-span-4">
          <ProjectDetailsCard
            code={project.code}
            status={project.archived_at ? "archived" : project.status}
            priority="Medium"
            managerName={manager?.profile?.full_name ?? null}
            managerEmail={manager?.profile?.email ?? null}
            clientName={project.client?.name ?? null}
            department="Social Development"
            createdAt={project.created_at ?? null}
            updatedAt={project.updated_at ?? null}
            tags={["Governance", "Community", "Fieldwork"]}
          />
          <RecentActivityCard
            items={recentItems}
            viewAllHref={`/workspace/projects/${id}`}
          />
        </div>

        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          <WorkplanOverviewCard phases={phaseRows} projectId={id} />
          <NextMilestonesCard
            milestones={milestones}
            viewAllHref={`/workspace/projects/${id}`}
            now={today.getTime()}
          />
        </div>
      </div>
    </div>
  );
}

