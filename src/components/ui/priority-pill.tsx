import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  high: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  low: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
};

const DOT: Record<string, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
};

export type Priority = "high" | "medium" | "low";

export function PriorityPill({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        STYLES[priority],
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT[priority])} />
      {priority}
    </span>
  );
}
