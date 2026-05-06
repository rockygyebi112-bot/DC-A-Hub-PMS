export type ActivityStatus = "not_started" | "in_progress" | "done" | "blocked";
export type ActivityPriority = "low" | "medium" | "high";
export type ProjectStatusOverride = "blocked" | "done" | null;
export type ComputedProjectStatus =
  | "not_started"
  | "in_progress"
  | "at_risk"
  | "blocked"
  | "done";

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_user_id: string | null;
  program_slug: string | null;
  start_date: string | null;
  target_end_date: string | null;
  status_override: ProjectStatusOverride;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  target_date: string | null;
  order_index: number;
  created_at: string;
}

export interface ProjectActivity {
  id: string;
  project_id: string;
  milestone_id: string | null;
  parent_activity_id: string | null;
  title: string;
  description: string | null;
  owner_user_id: string | null;
  due_date: string | null;
  status: ActivityStatus;
  priority: ActivityPriority;
  percent_complete: number;
  last_update_text: string | null;
  last_update_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectActivityUpdate {
  id: string;
  activity_id: string;
  user_id: string;
  note: string;
  status_before: ActivityStatus | null;
  status_after: ActivityStatus | null;
  created_at: string;
}

export interface ProjectActivityAttachment {
  id: string;
  activity_id: string;
  uploaded_by: string | null;
  file_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  created_at: string;
}
