"use client";

import { useState } from "react";
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
  responsible: string | null;
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
 * Tiny pill button shown in each phase header. Clicking it toggles the
 * activity list below to that status — clicking the active one clears the
 * filter. Lives inside the `<summary>` so we stop the click from bubbling
 * up and toggling the `<details>` open/closed state.
 */
function StatPill({
  active,
  label,
  count,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  tone: "not_started" | "in_progress" | "done";
  onClick: () => void;
}) {
  const toneClass =
    tone === "done"
      ? active
        ? "bg-emerald-500 text-white border-emerald-500"
        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      : tone === "in_progress"
        ? active
          ? "bg-amber-500 text-white border-amber-500"
          : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        : active
          ? "bg-red-500 text-white border-red-500"
          : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100";
  return (
    <button
      type="button"
      onClick={(e) => {
        // Don't let the click reach the parent <summary>, otherwise toggling
        // a filter would also collapse/expand the phase card.
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      disabled={count === 0}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed",
        toneClass,
      )}
    >
      <span className="font-mono tabular-nums">{count}</span>
      <span>{label}</span>
    </button>
  );
}

/**
 * Workplan view used in the portal. Replaces the old top-of-page filter
 * chips with per-phase stat pills inside each phase header — clicking
 * "2 done" filters that phase to its done activities, "3 in progress"
 * to in-progress, and "1 not started" to the work that hasn't begun.
 * Clicking the active pill clears the filter for that phase.
 */
export function PortalWorkplanPhases({
  projectId,
  phases,
}: {
  projectId: string;
  phases: Phase[];
}) {
  // Each phase has its own filter; missing entries mean "show all". Keeping
  // state in a Map keyed by phase id is cheap and survives re-render order.
  const [filters, setFilters] = useState<Record<string, ActivityStatusKey>>({});

  if (phases.length === 0) {
    return (
      <SectionCard>
        <p className="py-8 text-center text-sm text-muted-foreground">
          No phases yet.
        </p>
      </SectionCard>
    );
  }

  function setPhaseFilter(phaseId: string, status: ActivityStatusKey) {
    setFilters((prev) => {
      const next = { ...prev };
      if (next[phaseId] === status) {
        // Toggle off — back to "show all".
        delete next[phaseId];
      } else {
        next[phaseId] = status;
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {phases.map((phase) => {
        const total = phase.activities.length;
        const done = phase.activities.filter((a) => a.status === "done").length;
        const inProgress = phase.activities.filter(
          (a) => a.status === "in_progress",
        ).length;
        const notStarted = total - done - inProgress;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        const phaseStatus: ActivityStatusKey =
          total === 0
            ? "not_started"
            : done === total
              ? "done"
              : done > 0 || inProgress > 0
                ? "in_progress"
                : "not_started";
        const activeFilter = filters[phase.id];
        const visibleActivities = activeFilter
          ? phase.activities.filter((a) => a.status === activeFilter)
          : phase.activities;

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
                </div>
                {(phase.start_date || phase.end_date || phase.description) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {phase.start_date || phase.end_date
                      ? `${formatDate(phase.start_date) ?? "TBD"} – ${formatDate(phase.end_date) ?? "TBD"}`
                      : ""}
                    {phase.description ? ` · ${phase.description}` : ""}
                  </p>
                )}

                {/* Clickable stat pills — these ARE the filter UI now. */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatPill
                    active={activeFilter === "done"}
                    label={`done · ${done}/${total}`}
                    count={done}
                    tone="done"
                    onClick={() => setPhaseFilter(phase.id, "done")}
                  />
                  <StatPill
                    active={activeFilter === "in_progress"}
                    label="in progress"
                    count={inProgress}
                    tone="in_progress"
                    onClick={() => setPhaseFilter(phase.id, "in_progress")}
                  />
                  <StatPill
                    active={activeFilter === "not_started"}
                    label="not started"
                    count={notStarted}
                    tone="not_started"
                    onClick={() => setPhaseFilter(phase.id, "not_started")}
                  />
                </div>

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
                activities={visibleActivities}
                emptyHint={
                  activeFilter
                    ? "No activities match this status."
                    : undefined
                }
              />
            </div>
          </details>
        );
      })}
    </div>
  );
}
