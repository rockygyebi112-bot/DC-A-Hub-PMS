/**
 * Single source of truth for activity-log / notification action labels.
 *
 * Previously these phrases were duplicated between the admin dashboard
 * feed ("created an entry on X") and the notifications bell ("New
 * activity created") — same actions, different wording, drift-prone.
 * Centralising here keeps the two surfaces honest and gives any future
 * surface (e.g. email digests) a place to read from.
 *
 * Two parallel maps:
 *   - LABEL: third-person, headline-style phrase for the bell
 *     ("Activity completed")
 *   - VERB:  past-tense verb phrase for the dashboard feed
 *     ("marked done on")
 *
 * Keep keys in sync with the `activity_log.action` enum in the DB.
 */

export type ActivityAction =
  | "created"
  | "updated"
  | "started"
  | "marked_done"
  | "proof_added"
  | "proof_deleted"
  | "proof_commented"
  | "proof_mentioned";

export const ACTIVITY_ACTION_LABEL: Record<ActivityAction, string> = {
  created: "New activity created",
  updated: "Activity updated",
  started: "Activity in progress",
  marked_done: "Activity completed",
  proof_added: "Document uploaded",
  proof_deleted: "Document removed",
  proof_commented: "New comment on document",
  proof_mentioned: "You were mentioned",
};

export const ACTIVITY_ACTION_VERB: Record<ActivityAction, string> = {
  created: "created",
  updated: "updated",
  started: "started",
  marked_done: "marked done on",
  proof_added: "uploaded a document to",
  proof_deleted: "removed a document from",
  proof_commented: "commented on a document in",
  proof_mentioned: "mentioned you in",
};

/** Look up the headline label; fallback humanises unknown action codes. */
export function actionLabel(action: string): string {
  return (
    ACTIVITY_ACTION_LABEL[action as ActivityAction] ??
    action.replaceAll("_", " ")
  );
}

/** Look up the verb phrase; fallback humanises unknown action codes. */
export function actionVerb(action: string): string {
  return (
    ACTIVITY_ACTION_VERB[action as ActivityAction] ??
    action.replaceAll("_", " ")
  );
}
