"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, FileCheck2 } from "lucide-react";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { cn } from "@/lib/utils";

type Activity = {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "done";
  planned_date: string | null;
  location: string | null;
  proofCount: number;
};

const FILTERS: { key: "all" | Activity["status"]; label: string }[] = [
  { key: "all", label: "All" },
  { key: "not_started", label: "Not started" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

function formatDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/**
 * Filterable list of activities for a single phase. Counts adjust live so
 * the user can see how many activities sit in each status before clicking
 * the chip. When a filter is empty we explain why instead of showing a
 * blank space.
 */
export function PhaseActivities({
  projectId,
  activities,
}: {
  projectId: string;
  activities: Activity[];
}) {
  const [filter, setFilter] = useState<"all" | Activity["status"]>("all");

  const counts = {
    all: activities.length,
    not_started: activities.filter((a) => a.status === "not_started").length,
    in_progress: activities.filter((a) => a.status === "in_progress").length,
    done: activities.filter((a) => a.status === "done").length,
  };

  const visible =
    filter === "all" ? activities : activities.filter((a) => a.status === filter);

  if (activities.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
        No activities in this phase yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const count = counts[f.key];
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-px font-mono text-[10px]",
                  active ? "bg-primary-foreground/20" : "bg-muted",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
          No activities match this filter.
        </p>
      ) : (
        <ul className="divide-y">
          {visible.map((activity) => (
            <li
              key={activity.id}
              className="flex flex-wrap items-center gap-3 py-2.5"
            >
              <Link
                href={`/portal/projects/${projectId}/activities/${activity.id}`}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-medium hover:underline">
                  {activity.name}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {activity.planned_date && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      {formatDate(activity.planned_date)}
                    </span>
                  )}
                  {activity.location && <span>· {activity.location}</span>}
                  {activity.proofCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      · <FileCheck2 className="size-3" />
                      {activity.proofCount} proof
                      {activity.proofCount === 1 ? "" : "s"}
                    </span>
                  )}
                </p>
              </Link>
              <ActivityStatus status={activity.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
