import { cn } from "@/lib/utils";

export type ActivityStatusValue = "not_started" | "in_progress" | "done";

const STYLES: Record<ActivityStatusValue, { pill: string; dot: string; label: string }> = {
  not_started: {
    pill: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50",
    dot: "bg-red-500",
    label: "Not started",
  },
  in_progress: {
    pill: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
    dot: "bg-amber-500",
    label: "In progress",
  },
  done: {
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
    dot: "bg-emerald-500",
    label: "Done",
  },
};

/**
 * Status pill for an activity (or phase aggregate). Red = Not started,
 * Yellow = In progress, Green = Done. Used everywhere we surface activity
 * progress so the colour language stays consistent across portal,
 * workspace and admin.
 */
export function ActivityStatus({ status }: { status: ActivityStatusValue }) {
  const meta = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        meta.pill,
      )}
    >
      <span className={cn("size-[5px] shrink-0 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}
