"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ComputedProjectStatus } from "@/features/projects";

const STATUS_CONFIG: Record<
  ComputedProjectStatus,
  {
    label: string;
    dotClass: string;
    pillClass: string;
  }
> = {
  not_started: {
    label: "Not started",
    dotClass: "bg-slate-400",
    pillClass:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  in_progress: {
    label: "In progress",
    dotClass: "bg-blue-500",
    pillClass:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  at_risk: {
    label: "At risk",
    dotClass: "bg-amber-500",
    pillClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  blocked: {
    label: "Blocked",
    dotClass: "bg-red-500",
    pillClass:
      "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  done: {
    label: "Done",
    dotClass: "bg-green-500",
    pillClass:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
};

interface StatusBadgeProps {
  status: ComputedProjectStatus;
  size?: "sm" | "md";
  className?: string;
  hideDot?: boolean;
  labelOverride?: string;
}

export const StatusBadge = React.memo(function StatusBadge({
  status,
  size = "sm",
  className,
  hideDot = false,
  labelOverride,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const label = labelOverride ?? config.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium shrink-0",
        size === "sm"
          ? "text-[10px] px-2 py-0.5"
          : "text-xs px-2.5 py-1",
        config.pillClass,
        className,
      )}
      title={label}
    >
      {!hideDot && (
        <span
          className={cn(
            "rounded-full",
            size === "sm" ? "size-[5px]" : "size-1.5",
            config.dotClass,
          )}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
});
