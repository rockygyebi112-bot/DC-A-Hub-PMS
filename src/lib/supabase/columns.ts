/**
 * Centralized `.select()` column lists for Supabase queries.
 *
 * Only column strings that are repeated verbatim across two or more callsites
 * live here. Query-specific shapes (one-off joins, partial selects driven by
 * a UI need) stay inline at the callsite — extracting those would force
 * every reader to chase a constant for no payoff.
 *
 * When the underlying schema changes, grep this file first: a single edit
 * propagates to every consumer instead of drifting across files.
 */

// profiles -- public columns (no auth fields)
export const PROFILE_PUBLIC = "id, user_id, full_name, email, role";
export const PROFILE_PUBLIC_WITH_STATUS = "id, user_id, full_name, email, role, is_active";
export const PROFILE_PUBLIC_WITH_STATUS_AND_CREATED =
  "id, user_id, full_name, email, role, is_active, created_at";

// profiles -- session shape used by getSessionUser() and account queries
export const PROFILE_SESSION = "user_id, email, full_name, role, avatar_url";
export const PROFILE_SESSION_WITH_STATUS =
  "user_id, email, full_name, role, avatar_url, is_active";

// profiles -- compact admin-check shape
export const PROFILE_ROLE_STATUS = "user_id, role, is_active";

// project_activity_counts view -- per-project totals
export const PROJECT_ACTIVITY_COUNTS = "project_id, total_count, done_count";

// phases -- canonical row shape
export const PHASE_ROW =
  "id, project_id, name, description, start_date, end_date, order_index";

// activities -- canonical row shape used by phase/activity reads
export const ACTIVITY_ROW =
  "id, phase_id, name, description, deliverable, planned_date, completed_date, status, narrative_note, responsible, order_index";

// activity_proofs -- canonical row shape for proof galleries
export const ACTIVITY_PROOF_ROW =
  "id, activity_id, kind, file_path, file_name, mime_type, size_bytes, caption, url, created_at";

// activity_log -- feed/timeline row
export const ACTIVITY_LOG_ROW = "id, action, created_at, actor_user_id, meta";

// activities -> phases inverse join, used by authorization checks that need
// to resolve `project_id` from an activity row before applying a guard
export const ACTIVITY_PROJECT_JOIN = "phase:phases(project_id)";
