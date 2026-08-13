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

/** The six meanings a pill can carry. Statuses map onto one of these rather
 *  than naming a colour, so re-theming happens in one place (the --pill-*
 *  tokens in globals.css) and light/dark stay in step automatically. */
type Tone = "success" | "warning" | "danger" | "info" | "accent" | "neutral";

const TONE: Record<Status, Tone> = {
  planning: "neutral",
  active: "success",
  paused: "warning",
  completed: "info",
  archived: "neutral",
  "active-user": "success",
  "inactive-user": "neutral",
  admin: "info",
  staff: "accent",
  client: "accent",
  manager: "warning",
  member: "success",
  viewer: "neutral",
};

const TONE_CLASS: Record<Tone, string> = {
  success:
    "bg-[var(--pill-success-bg)] text-[var(--pill-success-fg)] border-[var(--pill-success-border)]",
  warning:
    "bg-[var(--pill-warning-bg)] text-[var(--pill-warning-fg)] border-[var(--pill-warning-border)]",
  danger:
    "bg-[var(--pill-danger-bg)] text-[var(--pill-danger-fg)] border-[var(--pill-danger-border)]",
  info: "bg-[var(--pill-info-bg)] text-[var(--pill-info-fg)] border-[var(--pill-info-border)]",
  accent:
    "bg-[var(--pill-accent-bg)] text-[var(--pill-accent-fg)] border-[var(--pill-accent-border)]",
  neutral:
    "bg-[var(--pill-neutral-bg)] text-[var(--pill-neutral-fg)] border-[var(--pill-neutral-border)]",
};

const TONE_DOT: Record<Tone, string> = {
  success: "bg-[var(--pill-success-dot)]",
  warning: "bg-[var(--pill-warning-dot)]",
  danger: "bg-[var(--pill-danger-dot)]",
  info: "bg-[var(--pill-info-dot)]",
  accent: "bg-[var(--pill-accent-dot)]",
  neutral: "bg-[var(--pill-neutral-dot)]",
};

const LABELS: Partial<Record<Status, string>> = {
  planning: "Planning",
  active: "Active",
  completed: "Done",
  "active-user": "Active",
  "inactive-user": "Inactive",
  manager: "Project Manager",
};

/** Statuses that carry a leading dot. Roles (admin/staff/client/…) are
 *  categories rather than states, so they read better without one. */
const WITH_DOT: ReadonlySet<Status> = new Set([
  "active",
  "paused",
  "completed",
  "active-user",
  "member",
]);

export function StatusPill({ status }: { status: Status }) {
  const label = LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  const tone = TONE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONE_CLASS[tone],
      )}
    >
      {WITH_DOT.has(status) && (
        <span className={cn("size-[5px] shrink-0 rounded-full", TONE_DOT[tone])} />
      )}
      {label}
    </span>
  );
}
