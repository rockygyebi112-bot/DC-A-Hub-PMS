import { Ban, CheckCircle2, Circle, Timer, type LucideIcon } from "lucide-react";

/**
 * Shared presentation metadata for internal tasks — one source of truth for the
 * board columns, the card, and the detail page so status/priority styling can't
 * drift between them.
 */

export type TaskStatus = "not_started" | "in_progress" | "blocked" | "done";

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "not_started",
  "in_progress",
  "blocked",
  "done",
];

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; icon: LucideIcon; dot: string }
> = {
  not_started: { label: "Not started", icon: Circle, dot: "bg-muted-foreground/40" },
  in_progress: { label: "In progress", icon: Timer, dot: "bg-blue-500" },
  blocked: { label: "Blocked", icon: Ban, dot: "bg-red-500" },
  done: { label: "Done", icon: CheckCircle2, dot: "bg-emerald-500" },
};

export function asTaskStatus(value: string): TaskStatus {
  return (TASK_STATUS_ORDER as string[]).includes(value)
    ? (value as TaskStatus)
    : "not_started";
}

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export const TASK_PRIORITY_ORDER: TaskPriority[] = ["low", "normal", "high", "urgent"];

export const TASK_PRIORITY_META: Record<
  TaskPriority,
  { label: string; variant: "neutral" | "info" | "warning" | "destructive" }
> = {
  low: { label: "Low", variant: "neutral" },
  normal: { label: "Normal", variant: "info" },
  high: { label: "High", variant: "warning" },
  urgent: { label: "Urgent", variant: "destructive" },
};
