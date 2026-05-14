"use client";

import Link from "next/link";
import { CalendarDays, FileCheck2 } from "lucide-react";
import { ActivityStatus } from "@/components/workspace/status-badge";

type Activity = {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "done";
  planned_date: string | null;
  // `responsible` is intentionally absent: who within DC&A is handling a
  // task is internal delivery info and is not shown in the client portal.
  proofCount: number;
};

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
 * Presentational list of activities for a single phase. The filter UI lives
 * in the parent phase header (clickable stat pills) so we just render
 * whatever list of activities we're handed. `emptyHint` lets the caller
 * customise the message when a filter narrows the list to zero results.
 */
export function PhaseActivities({
  projectId,
  activities,
  emptyHint,
}: {
  projectId: string;
  activities: Activity[];
  emptyHint?: string;
}) {
  if (activities.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
        {emptyHint ?? "No activities in this phase yet."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y">
        {activities.map((activity) => (
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
                  {activity.proofCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      · <FileCheck2 className="size-3" />
                      {activity.proofCount} document
                      {activity.proofCount === 1 ? "" : "s"}
                    </span>
                  )}
                </p>
              </Link>
              <ActivityStatus status={activity.status} />
            </li>
          ))}
      </ul>
    </div>
  );
}
