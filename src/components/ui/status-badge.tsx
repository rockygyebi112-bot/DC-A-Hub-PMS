import { cn } from "@/lib/utils";

/**
 * Generic status badge. Maps a status keyword (case-insensitive) to a
 * brand-aware colour treatment. Unknown statuses fall back to a neutral
 * style so callers can render arbitrary backend values safely.
 *
 * Use this everywhere a project / activity / deliverable / invitation
 * exposes a state — replaces ad-hoc `<span>` pills scattered through
 * the codebase.
 */
export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "purple";

const TONE_STYLES: Record<StatusTone, string> = {
  neutral:
    "bg-muted text-muted-foreground border-border",
  info:
    "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  success:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  warning:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  danger:
    "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  purple:
    "bg-srsf-purple-100 text-srsf-purple-700 dark:bg-srsf-purple-950 dark:text-srsf-purple-200 border-srsf-purple-300/40",
};

const DOT_STYLES: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground/60",
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  purple: "bg-srsf-purple-500",
};

/** Default mapping from common status keywords to a tone. */
const STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  pending: "warning",
  invited: "info",
  active: "success",
  ongoing: "info",
  "in-progress": "info",
  in_progress: "info",
  inprogress: "info",
  blocked: "danger",
  on_hold: "warning",
  paused: "warning",
  done: "success",
  completed: "success",
  closed: "neutral",
  archived: "neutral",
  cancelled: "danger",
  canceled: "danger",
  failed: "danger",
  approved: "success",
  rejected: "danger",
  review: "purple",
  "in-review": "purple",
  in_review: "purple",
};

function prettify(status: string) {
  return status.replace(/[_-]+/g, " ").trim();
}

export function statusToTone(status: string): StatusTone {
  return STATUS_TONE[status.toLowerCase()] ?? "neutral";
}

export function StatusBadge({
  status,
  tone,
  className,
  showDot = true,
  size = "md",
}: {
  /** Raw status string — case-insensitive. Used for label and (optionally) tone. */
  status: string;
  /** Override the auto-detected tone. */
  tone?: StatusTone;
  className?: string;
  showDot?: boolean;
  size?: "sm" | "md";
}) {
  const resolved = tone ?? statusToTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium capitalize",
        size === "sm"
          ? "px-1.5 py-0.5 text-[10px]"
          : "px-2 py-0.5 text-xs",
        TONE_STYLES[resolved],
        className,
      )}
    >
      {showDot ? (
        <span className={cn("size-1.5 rounded-full", DOT_STYLES[resolved])} />
      ) : null}
      {prettify(status)}
    </span>
  );
}
