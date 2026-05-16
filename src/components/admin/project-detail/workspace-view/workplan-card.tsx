"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  FileText,
  Filter,
  ListChecks,
  Search,
} from "lucide-react";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { formatDate } from "@/components/admin/project-detail/parts";
import { cn } from "@/lib/utils";
import { PhaseBadge, PriorityDot, StatusBadge } from "./badges";
import type { WVActivity, WVPhase } from "./types";

function PhaseHeader({
  phase,
  expanded,
  onToggle,
}: {
  phase: WVPhase;
  expanded: boolean;
  onToggle: () => void;
}) {
  const total = phase.activities.length;
  const done = phase.activities.filter((a) => a.status === "done").length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const barColor =
    total === 0 || done === 0
      ? "bg-muted-foreground/40"
      : done === total
        ? "bg-emerald-500"
        : "bg-[var(--color-dca-blue-500)]";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="grid w-full grid-cols-12 items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-muted/30"
    >
      <div className="col-span-12 flex items-center gap-2 sm:col-span-5">
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            !expanded && "-rotate-90",
          )}
        />
        <span className="text-sm font-semibold">{phase.name}</span>
        <PhaseBadge done={done} total={total} />
      </div>
      <div className="col-span-6 text-xs text-muted-foreground sm:col-span-3">
        {done} / {total} activities completed
      </div>
      <div className="col-span-6 sm:col-span-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", barColor)}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums">
            {percent}%
          </span>
        </div>
      </div>
      <div className="col-span-12 hidden justify-end sm:col-span-1 sm:flex" />
    </button>
  );
}

function ActivityCard({ activity }: { activity: WVActivity }) {
  const assigneeName = activity.responsible ?? "Unassigned";
  const assigneeEmail = (activity.responsible ?? "unassigned").toLowerCase();
  return (
    <li className="row-cv-card rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {activity.status === "done" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 fill-emerald-500 text-white" />
          ) : activity.status === "in_progress" ? (
            <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-dca-blue-500)]">
              <span className="size-1.5 rounded-full bg-[var(--color-dca-blue-500)]" />
            </span>
          ) : (
            <span className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
          )}
          <span className="text-[13px] font-medium leading-snug text-foreground break-words">
            {activity.name}
          </span>
        </div>
        <PriorityDot p={activity.priority ?? "medium"} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-6 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <UserAvatar name={assigneeName} email={assigneeEmail} size="sm" />
          <span className="text-foreground/80">{assigneeName}</span>
        </span>
        {activity.planned_date ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" />
            {formatDate(activity.planned_date)}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <FileText className="size-3 text-rose-500" />
          <span className="rounded bg-muted px-1.5 py-0.5 font-semibold tabular-nums">
            +{activity.proofCount}
          </span>
        </span>
        <StatusBadge status={activity.status} />
      </div>
    </li>
  );
}

function ActivityRow({ activity }: { activity: WVActivity }) {
  const assigneeName = activity.responsible ?? "Unassigned";
  const assigneeEmail = (activity.responsible ?? "unassigned").toLowerCase();
  return (
    <tr className="group border-t border-border transition-colors hover:bg-muted/30">
      <td className="px-5 py-3 align-top">
        <div className="flex items-start gap-2.5">
          {activity.status === "done" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 fill-emerald-500 text-white" />
          ) : activity.status === "in_progress" ? (
            <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-dca-blue-500)]">
              <span className="size-1.5 rounded-full bg-[var(--color-dca-blue-500)]" />
            </span>
          ) : (
            <span className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
          )}
          <span className="text-[12.5px] font-medium leading-snug text-foreground break-words">
            {activity.name}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-start gap-2">
          <UserAvatar name={assigneeName} email={assigneeEmail} size="sm" />
          <span className="text-[12px] font-medium leading-snug break-words">
            {assigneeName}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 align-top text-[12px] whitespace-nowrap">
        {activity.planned_date ? (
          <span className="inline-flex items-center gap-1.5 text-foreground/80">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            {formatDate(activity.planned_date)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <StatusBadge status={activity.status} />
      </td>
      <td className="px-3 py-3 align-top">
        <span className="inline-flex items-center gap-1 text-[12px] text-foreground/80">
          <FileText className="size-3.5 text-rose-500" />
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
            +{activity.proofCount}
          </span>
        </span>
      </td>
      <td className="px-3 py-3 align-top">
        <PriorityDot p={activity.priority ?? "medium"} />
      </td>
    </tr>
  );
}

export function WorkplanCard({
  phases,
  projectId,
}: {
  phases: WVPhase[];
  projectId: string;
}) {
  const initiallyExpanded = useMemo(() => {
    // Auto-expand the first phase that is in progress, else first phase.
    const inProgress = phases.findIndex((p) =>
      p.activities.some((a) => a.status !== "done"),
    );
    const idx = inProgress === -1 ? 0 : inProgress;
    return phases[idx]?.id ?? null;
  }, [phases]);

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initiallyExpanded ? [initiallyExpanded] : []),
  );
  const [search, setSearch] = useState("");

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const q = search.trim().toLowerCase();

  return (
    <section className="rounded-[16px] border border-border bg-card shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="space-y-0.5">
          <h2 className="font-heading text-base font-semibold tracking-tight">
            Workplan
          </h2>
          <p className="text-xs text-muted-foreground">
            Track progress of project phases and activities.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Filter className="size-3.5" />
            Filter
          </button>
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 size-3.5 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activities..."
              className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary sm:w-[200px]"
            />
          </label>
        </div>
      </header>

      {phases.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm font-semibold">No phases yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Build your workplan to start tracking activities here.
          </p>
          <Link
            href={`/workspace/projects/${projectId}`}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-dca-blue-500)] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-dca-blue-600)]"
          >
            <ListChecks className="size-4" />
            Manage workplan
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {phases.map((phase) => {
            const isExpanded = expanded.has(phase.id);
            const filtered = q
              ? phase.activities.filter((a) =>
                  a.name.toLowerCase().includes(q),
                )
              : phase.activities;
            return (
              <div key={phase.id}>
                <PhaseHeader
                  phase={phase}
                  expanded={isExpanded}
                  onToggle={() => toggle(phase.id)}
                />
                {isExpanded && filtered.length > 0 && (
                  <>
                  {/* Mobile: stacked card list — a six-column table is a
                      horizontal-scroll trap on phones. */}
                  <ul className="space-y-2 border-t border-border bg-muted/10 p-3 md:hidden">
                    {filtered.map((a) => (
                      <ActivityCard key={a.id} activity={a} />
                    ))}
                  </ul>
                  <div className="hidden overflow-x-auto border-t border-border bg-muted/10 md:block">
                    <table className="w-full min-w-[840px] table-fixed">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th
                            className="px-5 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"
                            style={{ width: "32%" }}
                          >
                            Activity
                          </th>
                          <th
                            className="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"
                            style={{ width: "18%" }}
                          >
                            Assignee
                          </th>
                          <th
                            className="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"
                            style={{ width: "13%" }}
                          >
                            Due date
                          </th>
                          <th
                            className="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"
                            style={{ width: "16%" }}
                          >
                            Status
                          </th>
                          <th
                            className="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"
                            style={{ width: "9%" }}
                          >
                            Evidence
                          </th>
                          <th
                            className="px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"
                            style={{ width: "8%" }}
                          >
                            Priority
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((a) => (
                          <ActivityRow key={a.id} activity={a} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
                {isExpanded && filtered.length === 0 && (
                  <div className="border-t border-border bg-muted/10 px-5 py-6 text-center text-xs text-muted-foreground">
                    No activities match your search.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
