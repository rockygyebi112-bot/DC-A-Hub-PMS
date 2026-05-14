import { cn } from "@/lib/utils";

type Status =
  | "planning"
  | "active"
  | "paused"
  | "completed"
  | "archived"
  | "active-user"
  | "inactive-user"
  | "admin"
  | "staff"
  | "client"
  | "manager"
  | "member"
  | "viewer";

const STYLES: Record<Status, string> = {
  planning:
    "bg-muted/60 text-foreground border-border",
  active:
    "bg-[var(--color-srsf-green-50)] text-[var(--color-srsf-green-700)] border-[var(--color-srsf-green-200)] dark:bg-[var(--color-srsf-green-900)]/40 dark:text-[var(--color-srsf-green-300)] dark:border-[var(--color-srsf-green-800)]/50",
  paused:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50",
  completed:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50",
  archived:
    "bg-[var(--status-archived)]/30 text-muted-foreground border-[var(--status-archived)]/60",
  "active-user":
    "bg-[var(--color-srsf-green-50)] text-[var(--color-srsf-green-700)] border-[var(--color-srsf-green-200)] dark:bg-[var(--color-srsf-green-900)]/40 dark:text-[var(--color-srsf-green-300)] dark:border-[var(--color-srsf-green-800)]/50",
  "inactive-user": "bg-muted text-muted-foreground border-border",
  admin: "bg-primary/15 text-primary border-primary/40",
  staff: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40",
  client:
    "bg-[var(--color-srsf-purple-50)] text-[var(--color-srsf-purple-700)] border-[var(--color-srsf-purple-200)] dark:bg-[var(--color-srsf-purple-900)]/40 dark:text-[var(--color-srsf-purple-300)] dark:border-[var(--color-srsf-purple-800)]/50",
  manager:
    "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/60",
  member:
    "bg-[var(--color-srsf-green-50)] text-[var(--color-srsf-green-700)] border-[var(--color-srsf-green-200)] dark:bg-[var(--color-srsf-green-900)]/40 dark:text-[var(--color-srsf-green-300)] dark:border-[var(--color-srsf-green-800)]/50",
  viewer: "bg-muted text-foreground border-border",
};

const LABELS: Partial<Record<Status, string>> = {
  planning: "Planning",
  active: "Active",
  completed: "Done",
  "active-user": "Active",
  "inactive-user": "Inactive",
  manager: "Project Manager",
};

const DOT_CLASS: Partial<Record<Status, string>> = {
  active: "bg-[var(--color-srsf-green-500)]",
  paused: "bg-amber-500",
  completed: "bg-blue-500",
  "active-user": "bg-[var(--color-srsf-green-500)]",
  member: "bg-[var(--color-srsf-green-500)]",
};

export function StatusPill({ status }: { status: Status }) {
  const label = LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  const dot = DOT_CLASS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        STYLES[status],
      )}
    >
      {dot && <span className={cn("size-[5px] rounded-full shrink-0", dot)} />}
      {label}
    </span>
  );
}
