"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { PhaseActivities } from "@/components/portal/phase-activities";
import { cn } from "@/lib/utils";

type ActivityStatusKey = "not_started" | "in_progress" | "done";

type Activity = {
  id: string;
  name: string;
  status: ActivityStatusKey;
  planned_date: string | null;
  location: string | null;
  proofCount: number;
};

type Phase = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  activities: Activity[];
};

const FILTERS: { key: "all" | ActivityStatusKey; label: string }[] = [
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
 * Client-side filterable wrapper around the portal workplan phases. Lets the
 * client narrow every phase to a single activity status (not started, in
 * progress, done) without a server round-trip. Phases that have no matching
 * activities are hidden so the page collapses to the relevant work.
 */
export function PortalWorkplanPhases({
  projectId,
  phases,
}: {
  projectId: string;
  phases: Phase[];
}) {
  const [filter, setFilter] = useState<"all" | ActivityStatusKey>("all");

  const counts = useMemo(() => {
    const all = phases.flatMap((p) => p.activities);
    return {
      all: all.length,
      not_started: all.filter((a) => a.status === "not_started").length,
      in_progress: all.filter((a) => a.status === "in_progress").length,
      done: all.filter((a) => a.status === "done").length,
    };
  }, [phases]);

  const filteredPhases = useMemo(() => {
    if (filter === "all") return phases;
    return phases
      .map((p) => ({
        ...p,
        activities: p.activities.filter((a) => a.status === filter),
      }))
      .filter((p) => p.activities.length > 0);
  }, [phases, filter]);

  if (phases.length === 0) {
    return (
      <SectionCard>
        <p className="py-8 text-center text-sm text-muted-foreground">
          No phases yet.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
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

      {filteredPhases.length === 0 ? (
        <SectionCard>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activities match this filter.
          </p>
        </SectionCard>
      ) : (
        filteredPhases.map((phase) => {
          const total = phase.activities.length;
          const done = phase.activities.filter((a) => a.status === "done").length;
          const inProgress = phase.activities.filter(
            (a) => a.status === "in_progress",
          ).length;
          const pct = total === 0 ? 0 : Math.round((done / total) * 100);
          const phaseStatus: ActivityStatusKey =
            total === 0
              ? "not_started"
              : done === total
                ? "done"
                : done > 0 || inProgress > 0
                  ? "in_progress"
                  : "not_started";

          return (
            <details
              key={phase.id}
              open
              className="group rounded-[14px] border bg-card shadow-card transition-smooth"
            >
              <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-0 -rotate-90" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-heading text-sm font-semibold tracking-tight">
                      {phase.name}
                    </h3>
                    <ActivityStatus status={phaseStatus} />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {done}/{total} done
                      {inProgress > 0 ? ` · ${inProgress} in progress` : ""}
                    </span>
                  </div>
                  {(phase.start_date || phase.end_date || phase.description) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {phase.start_date || phase.end_date
                        ? `${formatDate(phase.start_date) ?? "TBD"} – ${formatDate(phase.end_date) ?? "TBD"}`
                        : ""}
                      {phase.description ? ` · ${phase.description}` : ""}
                    </p>
                  )}
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        phaseStatus === "done"
                          ? "bg-emerald-500"
                          : phaseStatus === "in_progress"
                            ? "bg-amber-500"
                            : "bg-red-400/60",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-heading text-2xl font-bold leading-none tracking-tight">
                    {pct}%
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    complete
                  </p>
                </div>
              </summary>

              <div className="border-t px-5 py-3">
                <PhaseActivities
                  projectId={projectId}
                  activities={phase.activities}
                />
              </div>
            </details>
          );
        })
      )}
    </div>
  );
}
