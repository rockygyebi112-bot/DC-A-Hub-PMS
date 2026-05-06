"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import { EChart } from "@/components/dashboard/echart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  donutChartOption,
  horizontalBarChartOption,
} from "@/components/dashboard/chart-builders";
import {
  computeProgressPercent,
  countNeedsAttention,
  countOverdue,
} from "@/lib/projects/status";
import type {
  Project,
  ProjectActivity,
  ProjectMilestone,
} from "@/lib/projects/types";

interface ProjectOverviewDashboardProps {
  project: Project;
  milestones: ProjectMilestone[];
  activities: ProjectActivity[];
}

const STATUS_LABELS: Record<ProjectActivity["status"], string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  done: "Done",
  blocked: "Blocked",
};

const PRIORITY_LABELS: Record<ProjectActivity["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function ProjectOverviewDashboard({
  project,
  milestones,
  activities,
}: ProjectOverviewDashboardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const overallProgress = computeProgressPercent(activities);
  const overdueCount = countOverdue(activities);
  const attentionCount = countNeedsAttention(activities);
  const completedCount = activities.filter((a) => a.status === "done").length;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const activity of activities) {
      const label = STATUS_LABELS[activity.status];
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return counts;
  }, [activities]);

  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const activity of activities) {
      const label = PRIORITY_LABELS[activity.priority];
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return counts;
  }, [activities]);

  const milestoneCounts = useMemo(() => {
    const names = new Map(
      milestones.map((milestone) => [milestone.id, milestone.name]),
    );
    const counts: Record<string, number> = {};

    for (const activity of activities) {
      const label = activity.milestone_id
        ? names.get(activity.milestone_id) ?? "Unknown milestone"
        : "Ungrouped";
      counts[label] = (counts[label] ?? 0) + 1;
    }

    return counts;
  }, [activities, milestones]);

  const upcomingActivities = useMemo(() => {
    return [...activities]
      .filter((activity) => activity.due_date && activity.status !== "done")
      .sort((left, right) => {
        const leftTime = new Date(left.due_date ?? "").getTime();
        const rightTime = new Date(right.due_date ?? "").getTime();
        return leftTime - rightTime;
      })
      .slice(0, 5);
  }, [activities]);

  if (activities.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card p-6 text-sm text-muted-foreground">
        No activities have been added for {project.name} yet. Once activities
        are created, this overview will show progress, status distribution, and
        upcoming deadlines.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Overall Progress"
          value={`${overallProgress}%`}
          accent="green"
          sublabel="Average across all activities"
        />
        <KpiCard
          label="Total Activities"
          value={activities.length}
          accent="blue"
          sublabel={`${milestones.length} milestone${
            milestones.length === 1 ? "" : "s"
          }`}
        />
        <KpiCard
          label="Completed"
          value={completedCount}
          accent="teal"
          sublabel={`${activities.length - completedCount} still open`}
        />
        <KpiCard
          label="Needs Attention"
          value={attentionCount}
          accent={overdueCount > 0 ? "pink" : "amber"}
          sublabel={
            overdueCount > 0
              ? `${overdueCount} overdue activit${
                  overdueCount === 1 ? "y" : "ies"
                }`
              : "No overdue activities"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <EChart option={donutChartOption(statusCounts, "Activity Status", isDark)} />
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <EChart
            option={horizontalBarChartOption(
              milestoneCounts,
              "Activities by Milestone",
              isDark,
            )}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold">Upcoming Deadlines</h3>
            <p className="text-sm text-muted-foreground">
              The next open activities that need movement.
            </p>
          </div>

          {upcomingActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No upcoming deadlines right now.
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="rounded-xl border border-border/60 bg-background p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {STATUS_LABELS[activity.status]} -{" "}
                        {activity.percent_complete}% complete
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Due {new Date(activity.due_date ?? "").toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <EChart option={donutChartOption(priorityCounts, "Priority Mix", isDark)} />
        </div>
      </div>
    </div>
  );
}
