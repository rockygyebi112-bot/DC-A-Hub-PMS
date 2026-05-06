import type {
  ActivityStatus,
  ComputedProjectStatus,
  Project,
  ProjectActivity,
} from "./types";

function isOverdue(activity: ProjectActivity, today: Date): boolean {
  if (!activity.due_date || activity.status === "done") return false;
  return new Date(activity.due_date) < today;
}

export function getChildren(
  activity: ProjectActivity,
  all: ProjectActivity[],
): ProjectActivity[] {
  return all.filter((a) => a.parent_activity_id === activity.id);
}

export function isParent(
  activity: ProjectActivity,
  all: ProjectActivity[],
): boolean {
  return all.some((a) => a.parent_activity_id === activity.id);
}

export function getLeafActivities(
  all: ProjectActivity[],
): ProjectActivity[] {
  const parentIds = new Set(
    all
      .map((a) => a.parent_activity_id)
      .filter((id): id is string => id !== null),
  );
  return all.filter((a) => !parentIds.has(a.id));
}

/**
 * Display-time percent for an activity. Parents auto-roll up from children;
 * leaves use status-derived rules (done=100, not_started=0) or the stored
 * percent_complete for in_progress / blocked.
 */
export function computeActivityPercent(
  activity: ProjectActivity,
  all: ProjectActivity[],
): number {
  const children = getChildren(activity, all);
  if (children.length > 0) {
    const total = children.reduce(
      (sum, c) => sum + computeActivityPercent(c, all),
      0,
    );
    return Math.round(total / children.length);
  }
  return normalizePercentComplete(activity.status, activity.percent_complete);
}

export function computeProjectStatus(
  project: Pick<Project, "status_override">,
  activities: ProjectActivity[],
  now: Date = new Date(),
): ComputedProjectStatus {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const leaves = getLeafActivities(activities);

  if (leaves.length > 0 && leaves.every((a) => a.status === "done")) {
    return "done";
  }
  if (project.status_override === "blocked") return "blocked";

  const hasOverdue = activities.some((a) => isOverdue(a, today));
  const hasHighBlocked = activities.some(
    (a) => a.priority === "high" && a.status === "blocked",
  );
  if (hasOverdue || hasHighBlocked) return "at_risk";

  if (leaves.some((a) => a.status !== "not_started")) return "in_progress";
  return "not_started";
}

/**
 * Project-level progress: average across leaf activities only, so a parent's
 * computed roll-up does not double-count its children.
 */
export function computeProgressPercent(activities: ProjectActivity[]): number {
  const leaves = getLeafActivities(activities);
  if (leaves.length === 0) return 0;
  const total = leaves.reduce(
    (sum, activity) =>
      sum +
      normalizePercentComplete(activity.status, activity.percent_complete),
    0,
  );
  return Math.round(total / leaves.length);
}

/**
 * Activity % is now status-derived; the stored percent_complete column is
 * kept in sync but no longer manually settable from the UI. If you need
 * finer-grained tracking, break the activity down into sub-activities.
 */
export function normalizePercentComplete(
  status: ActivityStatus,
  // kept for call-site compatibility; ignored
  _percentComplete?: number,
): number {
  switch (status) {
    case "not_started":
      return 0;
    case "in_progress":
      return 50;
    case "blocked":
      return 50;
    case "done":
      return 100;
  }
}

export function countOverdue(
  activities: ProjectActivity[],
  now: Date = new Date(),
): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return activities.filter((a) => isOverdue(a, today)).length;
}

export function countNeedsAttention(activities: ProjectActivity[]): number {
  return activities.filter(
    (a) => a.status === "blocked" || a.priority === "high",
  ).length;
}

export const STATUS_LABEL: Record<ComputedProjectStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  at_risk: "At Risk",
  blocked: "Blocked",
  done: "Done",
};

export const STATUS_TONE: Record<
  ComputedProjectStatus,
  "neutral" | "blue" | "amber" | "red" | "green"
> = {
  not_started: "neutral",
  in_progress: "blue",
  at_risk: "amber",
  blocked: "red",
  done: "green",
};
