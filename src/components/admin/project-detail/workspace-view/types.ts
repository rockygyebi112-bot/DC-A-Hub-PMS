import type { Milestone } from "@/components/admin/project-detail/parts";

/**
 * Types shared across the workspace-view sub-components. Kept in their own
 * module (instead of the slim entry file) so individual cards can import only
 * what they need without dragging the whole tree of React components along.
 */

export type WVActivity = {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "done";
  planned_date: string | null;
  completed_date: string | null;
  responsible: string | null;
  proofCount: number;
  commentCount?: number;
  priority?: "low" | "medium" | "high";
  updatedAt?: string | null;
};

export type WVPhase = {
  id: string;
  name: string;
  activities: WVActivity[];
};

export type WVMilestone = {
  id: string;
  title: string;
  date: string; // ISO
  daysFromNow: number;
};

export type WVUpdate = {
  id: string;
  text: string;
  actor: string;
  when: string;
  tone: "green" | "blue" | "amber" | "gray";
};

export type WorkspaceViewProps = {
  projectId: string;
  projectName: string;
  projectCode: string;
  status: "planning" | "active" | "paused" | "completed" | "archived";
  clientName: string | null;
  clientId: string | null;
  startDate: string | null;
  endDate: string | null;
  remainingDays: number | null;
  updatedAt: string | null;
  managerName: string | null;
  managerEmail: string | null;
  doneCount: number;
  totalCount: number;
  clientDoneCount: number;
  clientTotalCount: number;
  health: "on-track" | "at-risk" | "delayed" | "not-started";
  phases: WVPhase[];
  team: { name: string; email: string; avatarUrl?: string | null }[];
  budget: {
    hasBudget: boolean;
    total: number;
    spent: number;
    currency: string;
  };
  milestones: WVMilestone[];
  nextMilestones: Milestone[];
  now: number;
  upcomingDeadlines: WVMilestone[];
  recentUpdates: WVUpdate[];
  overdueCount: number;
  dueThisWeek: number;
};
