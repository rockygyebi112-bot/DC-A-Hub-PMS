import type { ComputedProjectStatus } from "@/lib/projects/types";

export type Timeframe = "30d" | "quarter" | "ytd";

export interface PortfolioHealth {
  active_projects: number;
  done_projects: number;
  on_track_count: number;
  at_risk_or_blocked: number;
  overdue_activities: number;
}

export interface AttentionRow {
  project_id: string;
  project_name: string;
  project_slug: string;
  computed_status: ComputedProjectStatus;
  percent_complete: number;
  overdue_count: number;
  blocked_count: number;
  owner_full_name: string | null;
  score: number;
}

export interface DeliveryTrendPoint {
  bucket_start: string; // ISO date
  bucket_label: string;
  completed: number;
}

export interface WorkloadRow {
  owner_user_id: string;
  full_name: string;
  open_count: number;
  overdue_count: number;
}
