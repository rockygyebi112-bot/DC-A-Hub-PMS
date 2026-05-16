import { cn } from "@/lib/utils";

/**
 * Tiny status/priority pills used inside the workplan table and snapshot
 * strip. Memoized at the import boundary by React's compiler when stable
 * — they re-render on every parent paint otherwise because the parents
 * (WorkplanCard, PhaseHeader) hold local state for search + expansion.
 */

export function StatusBadge({
  status,
}: {
  status: "not_started" | "in_progress" | "done";
}) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
        Completed
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
        In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
      Not Started
    </span>
  );
}

export function PhaseBadge({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  if (total === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
        Not Started
      </span>
    );
  }
  if (done === total) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
        Completed
      </span>
    );
  }
  if (done === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
        Not Started
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
      In Progress
    </span>
  );
}

export function PriorityDot({ p }: { p: "low" | "medium" | "high" }) {
  const dotClass =
    p === "high"
      ? "bg-red-500"
      : p === "medium"
        ? "bg-amber-500"
        : "bg-muted-foreground/50";
  const label = p === "high" ? "High" : p === "medium" ? "Medium" : "Low";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-foreground/80">
      <span className={cn("size-1.5 rounded-full", dotClass)} />
      {label}
    </span>
  );
}

export function DaysBadge({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-semibold text-red-700">
        {Math.abs(days)} day{Math.abs(days) === 1 ? "" : "s"} overdue
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
        Due today
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700">
      In {days} day{days === 1 ? "" : "s"}
    </span>
  );
}
