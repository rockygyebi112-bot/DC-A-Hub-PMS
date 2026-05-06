"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  computeProgressPercent,
  computeProjectStatus,
} from "@/lib/projects/status";
import type {
  Project,
  ProjectActivity,
  ProjectMilestone,
} from "@/lib/projects/types";

export interface ProjectBundle {
  project: Project;
  milestones: ProjectMilestone[];
  activities: ProjectActivity[];
  ownerNames: Record<string, string>;
}

interface Props {
  bundles: ProjectBundle[];
}

function StatusDotStrip({ activities }: { activities: ProjectActivity[] }) {
  const counts = { done: 0, in_progress: 0, blocked: 0, not_started: 0 };
  for (const activity of activities) counts[activity.status]++;
  const total = activities.length || 1;
  const segments = [
    { key: "done", color: "#16a34a", count: counts.done },
    { key: "in_progress", color: "#3b82f6", count: counts.in_progress },
    { key: "blocked", color: "#dc2626", count: counts.blocked },
    { key: "not_started", color: "#e2e8f0", count: counts.not_started },
  ].filter((segment) => segment.count > 0);

  return (
    <div className="flex gap-[2px] items-center h-[6px]" style={{ width: 72 }}>
      {segments.map((segment) => (
        <div
          key={segment.key}
          className="h-full rounded-sm"
          style={{
            background: segment.color,
            width: `${(segment.count / total) * 72}px`,
            minWidth: 4,
          }}
        />
      ))}
    </div>
  );
}

function ProjectBlock({
  bundle,
  defaultOpen,
}: {
  bundle: ProjectBundle;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [openMilestones, setOpenMilestones] = useState<Set<string>>(new Set());
  const { project, milestones, activities } = bundle;

  const progress = computeProgressPercent(activities);
  const status = computeProjectStatus(project, activities);

  const statusStripe: Record<string, string> = {
    not_started: "#94a3b8",
    in_progress: "#3B6D11",
    at_risk: "#f59e0b",
    blocked: "#dc2626",
    done: "#16a34a",
  };

  const toggleMilestone = (id: string) =>
    setOpenMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <div className="rounded-lg border border-border overflow-hidden mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors border-b border-border"
      >
        <div
          className="w-[3px] h-7 rounded-full shrink-0"
          style={{ background: statusStripe[status] ?? "#94a3b8" }}
        />
        <span className="flex-1 text-left text-sm font-medium truncate">
          {project.name}
        </span>
        <span
          className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0",
            status === "in_progress" &&
              "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
            status === "blocked" &&
              "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
            status === "done" &&
              "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
            status === "at_risk" &&
              "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
            status === "not_started" &&
              "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
          )}
        >
          {{
            not_started: "Not started",
            in_progress: "In progress",
            at_risk: "At risk",
            blocked: "Blocked",
            done: "Done",
          }[status]}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-[80px] h-[5px] rounded-full bg-muted overflow-hidden hidden sm:block">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                background: statusStripe[status],
              }}
            />
          </div>
          <span className="text-xs font-medium text-foreground w-8 text-right">
            {progress}%
          </span>
          <span className="text-[10px] text-muted-foreground">
            {open ? "\u25BC" : "\u25B6"}
          </span>
        </div>
      </button>

      {open && (
        <div>
          <div className="hidden sm:grid grid-cols-[1fr_80px_90px_72px_60px] gap-3 px-4 py-1.5 border-b border-border bg-muted/20">
            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Milestone
            </span>
            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Activities
            </span>
            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Progress
            </span>
            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </span>
            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground text-right">
              Flags
            </span>
          </div>

          {milestones.map((milestone) => {
            const milestoneActivities = activities.filter(
              (activity) =>
                activity.milestone_id === milestone.id &&
                !activity.parent_activity_id,
            );
            const doneCount = milestoneActivities.filter(
              (activity) => activity.status === "done",
            ).length;
            const total = milestoneActivities.length;
            const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
            const overdueCount = milestoneActivities.filter(
              (activity) =>
                activity.due_date &&
                activity.status !== "done" &&
                new Date(activity.due_date) < new Date(),
            ).length;
            const blockedCount = milestoneActivities.filter(
              (activity) => activity.status === "blocked",
            ).length;
            const milestoneOpen = openMilestones.has(milestone.id);

            return (
              <div
                key={milestone.id}
                className={cn(
                  blockedCount > 0 && "bg-red-50/30 dark:bg-red-900/5",
                )}
              >
                <button
                  onClick={() => toggleMilestone(milestone.id)}
                  className="w-full flex sm:grid sm:grid-cols-[1fr_80px_90px_72px_60px] items-center gap-2 sm:gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors border-b border-border/50 text-left"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-[16px] h-[16px] rounded-[4px] bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 flex items-center justify-center text-[9px] shrink-0">
                      O
                    </span>
                    <span className="text-xs text-foreground truncate">
                      {milestone.name}
                    </span>
                    <span className="text-[9px] text-muted-foreground ml-auto sm:hidden shrink-0">
                      {doneCount}/{total} - {pct}%
                    </span>
                  </div>

                  <span className="hidden sm:block text-[11px] text-muted-foreground">
                    {doneCount} of {total}
                  </span>

                  <div className="hidden sm:flex items-center gap-1.5">
                    <div className="flex-1 h-[4px] rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: pct === 100 ? "#16a34a" : "#3B6D11",
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-foreground w-7 text-right">
                      {pct}%
                    </span>
                  </div>

                  <div className="hidden sm:block">
                    <StatusDotStrip activities={milestoneActivities} />
                  </div>

                  <div className="hidden sm:flex gap-1 justify-end">
                    {overdueCount > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 font-medium whitespace-nowrap">
                        {overdueCount} late
                      </span>
                    )}
                    {blockedCount > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 font-medium whitespace-nowrap">
                        {blockedCount} blocked
                      </span>
                    )}
                    {pct === 100 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 font-medium">
                        OK
                      </span>
                    )}
                  </div>
                </button>

                {milestoneOpen && (
                  <div className="bg-muted/20 border-b border-border/50">
                    {milestoneActivities.map((activity) => {
                      const overdue =
                        activity.due_date &&
                        activity.status !== "done" &&
                        new Date(activity.due_date) < new Date();
                      return (
                        <div
                          key={activity.id}
                          className={cn(
                            "flex items-center gap-2.5 px-4 sm:px-10 py-2 border-b border-border/30",
                            "last:border-b-0 hover:bg-muted/40 transition-colors",
                            activity.status === "blocked" &&
                              "bg-red-50/50 dark:bg-red-900/10",
                          )}
                        >
                          <div
                            className={cn(
                              "w-[14px] h-[14px] rounded-full border-[1.5px] flex items-center justify-center text-[7px] shrink-0",
                              activity.status === "not_started" &&
                                "border-slate-300 text-slate-400",
                              activity.status === "in_progress" &&
                                "border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                              activity.status === "done" &&
                                "border-green-300 bg-green-50 text-green-600 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400",
                              activity.status === "blocked" &&
                                "border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400",
                            )}
                          >
                            {{
                              done: "\u2713",
                              blocked: "\u2715",
                              in_progress: "\u25D1",
                              not_started: "",
                            }[activity.status]}
                          </div>

                          <span
                            className={cn(
                              "flex-1 text-[11px] truncate",
                              activity.status === "done" &&
                                "line-through text-muted-foreground",
                            )}
                          >
                            {activity.title}
                          </span>

                          <span className="hidden md:block text-[10px] text-muted-foreground truncate max-w-[80px]">
                            {bundle.ownerNames[activity.owner_user_id ?? ""] ?? "-"}
                          </span>

                          {activity.due_date && (
                            <span
                              className={cn(
                                "text-[10px] tabular-nums shrink-0 hidden sm:block",
                                overdue
                                  ? "text-red-600 font-medium dark:text-red-400"
                                  : "text-muted-foreground",
                              )}
                            >
                              {new Date(activity.due_date).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" },
                              )}
                            </span>
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            <div className="w-[30px] h-[3px] rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${activity.percent_complete}%`,
                                  background:
                                    activity.percent_complete === 100
                                      ? "#16a34a"
                                      : "#3B6D11",
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground w-6 text-right">
                              {activity.percent_complete}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {milestoneActivities.length === 0 && (
                      <p className="text-[11px] text-muted-foreground px-10 py-3">
                        No activities in this milestone.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {(() => {
            const ungrouped = activities.filter(
              (activity) =>
                !activity.milestone_id && !activity.parent_activity_id,
            );
            if (ungrouped.length === 0) return null;
            return (
              <div className="px-4 py-2 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground mb-1">
                  {ungrouped.length} ungrouped{" "}
                  {ungrouped.length === 1 ? "activity" : "activities"}
                </p>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export function ExecutiveMilestoneView({ bundles }: Props) {
  if (bundles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        No project milestones yet.
      </div>
    );
  }

  const allActivities = bundles.flatMap((bundle) => bundle.activities);
  const allMilestones = bundles.flatMap((bundle) => bundle.milestones);
  const totalMs = allMilestones.length;
  const doneMs = bundles.reduce((count, bundle) => {
    return (
      count +
      bundle.milestones.filter((milestone) => {
        const activities = bundle.activities.filter(
          (activity) => activity.milestone_id === milestone.id,
        );
        return activities.length > 0 && activities.every((a) => a.status === "done");
      }).length
    );
  }, 0);
  const totalOverdue = allActivities.filter(
    (activity) =>
      activity.due_date &&
      activity.status !== "done" &&
      new Date(activity.due_date) < new Date(),
  ).length;
  const totalBlocked = allActivities.filter(
    (activity) => activity.status === "blocked",
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Milestones",
            value: totalMs,
            sub: `across ${bundles.length} projects`,
            accent: "#3B6D11",
          },
          {
            label: "Done",
            value: doneMs,
            sub: `${totalMs > 0 ? Math.round((doneMs / totalMs) * 100) : 0}% completion rate`,
            accent: "#16a34a",
          },
          {
            label: "Overdue",
            value: totalOverdue,
            sub: "activities past due",
            accent: "#dc2626",
          },
          {
            label: "Blocked",
            value: totalBlocked,
            sub: "needs attention",
            accent: "#f59e0b",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="relative rounded-lg border border-border bg-card px-4 py-3 overflow-hidden"
          >
            <div
              className="absolute left-0 top-0 w-[3px] h-full rounded-l-lg"
              style={{ background: kpi.accent }}
            />
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
              {kpi.label}
            </p>
            <p className="text-2xl font-medium text-foreground leading-none">
              {kpi.value}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {bundles.map((bundle, index) => (
        <ProjectBlock
          key={bundle.project.id}
          bundle={bundle}
          defaultOpen={index === 0}
        />
      ))}
    </div>
  );
}
