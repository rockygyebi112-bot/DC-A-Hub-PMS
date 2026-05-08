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
  | "member"
  | "viewer";

const STYLES: Record<Status, string> = {
  planning: "bg-[var(--status-planning)]/15 text-foreground border-[var(--status-planning)]/40",
  active: "bg-[var(--status-active)]/15 text-[var(--status-active)] border-[var(--status-active)]/40",
  paused: "bg-[var(--status-paused)]/15 text-[var(--status-paused)] border-[var(--status-paused)]/40",
  completed: "bg-[var(--status-completed)]/15 text-foreground border-[var(--status-completed)]/40",
  archived: "bg-[var(--status-archived)]/30 text-muted-foreground border-[var(--status-archived)]/60",
  "active-user": "bg-[var(--status-active)]/15 text-[var(--status-active)] border-[var(--status-active)]/40",
  "inactive-user": "bg-muted text-muted-foreground border-border",
  admin: "bg-primary/15 text-primary border-primary/40",
  staff: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40",
  client: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/40",
  member: "bg-[var(--status-active)]/15 text-[var(--status-active)] border-[var(--status-active)]/40",
  viewer: "bg-muted text-foreground border-border",
};

const LABELS: Partial<Record<Status, string>> = {
  planning: "Not started",
  active: "Ongoing",
  completed: "Done",
  "active-user": "Active",
  "inactive-user": "Inactive",
};

export function StatusPill({ status }: { status: Status }) {
  const label = LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        STYLES[status],
      )}
    >
      {label}
    </span>
  );
}
