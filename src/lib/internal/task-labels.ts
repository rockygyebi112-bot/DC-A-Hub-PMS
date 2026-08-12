/**
 * Priority vocabulary for internal tasks, free of React and lucide-react so
 * server code (the assignment email) can share it with the UI.
 *
 * `TASK_PRIORITY_META` in `src/components/internal/task-meta.ts` builds its
 * badge styling on top of these labels, so the email and the task card can
 * never disagree about what `high` is called.
 */
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export const TASK_PRIORITY_ORDER: TaskPriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
];

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

/** Display label for a raw DB priority value; returns null for null/unknown. */
export function priorityLabel(value: string | null): string | null {
  if (!value) return null;
  return TASK_PRIORITY_LABEL[value as TaskPriority] ?? value;
}
