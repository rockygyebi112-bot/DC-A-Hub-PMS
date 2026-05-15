"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  ListChecks,
  Paperclip,
  Pencil,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Activity as ActivityIcon,
  TrendingUp,
  Users,
} from "lucide-react";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import {
  ProgressDonut,
  formatDate,
  formatRelative,
  formatCurrency,
  NextMilestonesCard,
  type Milestone,
} from "@/components/admin/project-detail/parts";
import { cn } from "@/lib/utils";

/* ---------------- Types passed in by the server page ---------------- */

export type WVActivity = {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "done";
  planned_date: string | null;
  completed_date: string | null;
  responsible: string | null;
  proofCount: number;
  commentCount?: number;
  priority?: "low" | "medium" | "high";
  updatedAt?: string | null;
};

export type WVPhase = {
  id: string;
  name: string;
  activities: WVActivity[];
};

export type WVMilestone = {
  id: string;
  title: string;
  date: string; // ISO
  daysFromNow: number;
};

export type WVUpdate = {
  id: string;
  text: string;
  actor: string;
  when: string;
  tone: "green" | "blue" | "amber" | "gray";
};

export type WorkspaceViewProps = {
  projectId: string;
  projectName: string;
  projectCode: string;
  status: "planning" | "active" | "paused" | "completed" | "archived";
  clientName: string | null;
  clientId: string | null;
  startDate: string | null;
  endDate: string | null;
  remainingDays: number | null;
  updatedAt: string | null;
  managerName: string | null;
  managerEmail: string | null;
  doneCount: number;
  totalCount: number;
  health: "on-track" | "at-risk" | "delayed" | "not-started";
  phases: WVPhase[];
  team: { name: string; email: string; avatarUrl?: string | null }[];
  budget: {
    hasBudget: boolean;
    total: number;
    spent: number;
    currency: string;
  };
  milestones: WVMilestone[];
  nextMilestones: Milestone[];
  now: number;
  upcomingDeadlines: WVMilestone[];
  recentUpdates: WVUpdate[];
  overdueCount: number;
  dueThisWeek: number;
};

/* ---------------- Small primitives ---------------- */

function StatusBadge({
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

function PhaseBadge({
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

function PriorityDot({ p }: { p: "low" | "medium" | "high" }) {
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

function DaysBadge({ days }: { days: number }) {
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

/* ---------------- Header ---------------- */

function ProjectHero(props: WorkspaceViewProps) {
  const percent =
    props.totalCount === 0
      ? 0
      : Math.round((props.doneCount / props.totalCount) * 100);
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-[32px]">
            {props.projectName}
          </h1>
          {props.status === "active" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          )}
          {props.status !== "active" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold capitalize text-muted-foreground">
              {props.status}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/70">
            {props.projectCode}
          </span>
          {props.clientName && (
            <>
              {" "}
              <span className="text-muted-foreground/60">•</span>{" "}
              <span>{props.clientName}</span>
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />
            Updated {formatRelative(props.updatedAt)}
          </span>
          {props.managerName && (
            <span className="inline-flex items-center gap-1.5">
              <UserAvatar
                name={props.managerName}
                email={props.managerEmail ?? props.managerName}
                size="sm"
                className="size-5"
              />
              <span className="font-medium text-foreground">
                {props.managerName}
              </span>
              <span className="text-muted-foreground/70">
                (Project Manager)
              </span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="relative inline-flex size-3.5 items-center justify-center">
              <svg viewBox="0 0 24 24" className="size-3.5 -rotate-90">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.18"
                  strokeWidth="3"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="var(--status-on-track)"
                  strokeWidth="3"
                  strokeDasharray={`${(percent / 100) * 56.5} 56.5`}
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="font-medium text-foreground">
              {percent}% complete
            </span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/workspace/projects/${props.projectId}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--color-dca-blue-500)] px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-dca-blue-600)]"
        >
          <SlidersHorizontal className="size-4" />
          Manage workplan
        </Link>
        <Link
          href={`/portal/projects/${props.projectId}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Eye className="size-4" />
          Client view
        </Link>
        <Link
          href={`/admin/projects/${props.projectId}/edit`}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Edit project"
        >
          <Pencil className="size-4" />
        </Link>
      </div>
    </div>
  );
}

/* ---------------- Snapshot strip ---------------- */

function SnapshotStrip(props: WorkspaceViewProps) {
  const percent =
    props.totalCount === 0
      ? 0
      : Math.round((props.doneCount / props.totalCount) * 100);
  const allActivities = props.phases.flatMap((p) => p.activities);
  const total = allActivities.length;
  const doneCount = allActivities.filter((a) => a.status === "done").length;
  const inProgressCount = allActivities.filter(
    (a) => a.status === "in_progress",
  ).length;
  const notStartedCount = allActivities.filter(
    (a) => a.status === "not_started",
  ).length;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  const budgetPercent = props.budget.hasBudget && props.budget.total > 0
    ? Math.min(100, Math.round((props.budget.spent / props.budget.total) * 100))
    : 0;

  return (
    <section className="rounded-[16px] border border-border bg-card shadow-card">
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-y-0 lg:grid-cols-6 lg:divide-x">
        {/* 1. Progress ring */}
        <div className="flex items-center gap-3 px-5 py-4">
          <ProgressDonut percent={percent} size={68} stroke={7} health={props.health} />
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] leading-tight text-muted-foreground">
              {props.doneCount} / {props.totalCount}
              <br />
              activities completed
            </p>
            {props.totalCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {props.health === "on-track"
                  ? "On track"
                  : props.health === "at-risk"
                    ? "At risk"
                    : props.health === "delayed"
                      ? "Delayed"
                      : "Not started"}
              </span>
            )}
          </div>
        </div>

        {/* 2. Timeline */}
        <div className="space-y-2 px-5 py-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="size-3.5" /> Timeline
          </div>
          <div className="space-y-1.5">
            <div>
              <p className="text-sm font-semibold leading-tight">
                {formatDate(props.startDate)}
              </p>
              <p className="text-[10.5px] text-muted-foreground">Start date</p>
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">
                {formatDate(props.endDate)}
              </p>
              <p className="text-[10.5px] text-muted-foreground">End date</p>
            </div>
            {props.remainingDays !== null && (
              <DaysBadge days={props.remainingDays} />
            )}
          </div>
        </div>

        {/* 3. Activity status */}
        <div className="space-y-2 px-5 py-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ActivityIcon className="size-3.5" /> Activity status
          </div>
          {total === 0 ? (
            <p className="text-sm text-muted-foreground">No activities yet</p>
          ) : (
            <ul className="space-y-1.5">
              {[
                {
                  label: "Not started",
                  count: notStartedCount,
                  bar: "bg-red-500",
                  dot: "bg-red-500",
                },
                {
                  label: "In progress",
                  count: inProgressCount,
                  bar: "bg-amber-500",
                  dot: "bg-amber-500",
                },
                {
                  label: "Done",
                  count: doneCount,
                  bar: "bg-emerald-500",
                  dot: "bg-emerald-500",
                },
              ].map((row) => (
                <li key={row.label} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-foreground/80">
                      <span className={cn("size-1.5 rounded-full", row.dot)} />
                      {row.label}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {row.count}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", row.bar)}
                      style={{ width: `${pct(row.count)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 4. Team */}
        <div className="space-y-2 px-5 py-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="size-3.5" /> Team
          </div>
          <p className="font-heading text-2xl font-bold tracking-tight leading-none">
            {props.team.length}
          </p>
          <p className="text-[10.5px] text-muted-foreground">
            Member{props.team.length === 1 ? "" : "s"}
          </p>
          {props.team.length > 0 && (
            <div className="flex -space-x-2 pt-1">
              {props.team.slice(0, 4).map((m) => (
                <UserAvatar
                  key={m.email}
                  name={m.name}
                  email={m.email}
                  avatarUrl={m.avatarUrl ?? null}
                  size="sm"
                  className="ring-2 ring-card"
                />
              ))}
              {props.team.length > 4 && (
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                  +{props.team.length - 4}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 5. Client */}
        <div className="space-y-2 px-5 py-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Shield className="size-3.5" /> Client
          </div>
          <p className="line-clamp-3 text-sm font-semibold leading-snug">
            {props.clientName ?? "No client"}
          </p>
          {props.clientId && (
            <Link
              href={`/admin/clients/${props.clientId}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-muted"
            >
              View client <ChevronRight className="size-3" />
            </Link>
          )}
        </div>

        {/* 6. Budget */}
        <div className="space-y-2 px-5 py-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="size-3.5" /> Budget
          </div>
          {props.budget.hasBudget ? (
            <>
              <p className="font-heading text-base font-bold tracking-tight">
                {formatCurrency(props.budget.total, props.budget.currency)}
              </p>
              <p className="text-[10.5px] text-muted-foreground">Total budget</p>
              <p className="pt-0.5 text-sm font-semibold">
                {formatCurrency(props.budget.spent, props.budget.currency)}{" "}
                <span className="font-normal text-muted-foreground">
                  ({budgetPercent}%)
                </span>
              </p>
              <p className="text-[10.5px] text-muted-foreground">Spent</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    budgetPercent >= 100
                      ? "bg-red-500"
                      : budgetPercent >= 80
                        ? "bg-amber-500"
                        : "bg-[var(--color-dca-blue-500)]",
                  )}
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-muted-foreground">
                Not set
              </p>
              <p className="text-[10.5px] text-muted-foreground">
                No budget configured
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Workplan card ---------------- */

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

function WorkplanCard({
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
              className="h-8 w-[200px] rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
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
                  <div className="overflow-x-auto border-t border-border bg-muted/10">
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

/* ---------------- Right rail ---------------- */

function ProjectHealthCard({
  health,
  overdueCount,
  dueThisWeek,
}: {
  health: "on-track" | "at-risk" | "delayed" | "not-started";
  overdueCount: number;
  dueThisWeek: number;
}) {
  const tone =
    health === "on-track"
      ? {
          ring: "bg-emerald-50 text-emerald-700 ring-emerald-100",
          headerColor: "text-emerald-600",
          headline: "On track",
          message: "The project is progressing well.",
          icon: ShieldCheck,
        }
      : health === "at-risk"
        ? {
            ring: "bg-amber-50 text-amber-700 ring-amber-100",
            headerColor: "text-amber-600",
            headline: "At risk",
            message: "Some activities need attention.",
            icon: AlertTriangle,
          }
        : health === "delayed"
          ? {
              ring: "bg-red-50 text-red-700 ring-red-100",
              headerColor: "text-red-600",
              headline: "Delayed",
              message: "Activities are running behind schedule.",
              icon: AlertTriangle,
            }
          : {
              ring: "bg-muted text-muted-foreground ring-border",
              headerColor: "text-muted-foreground",
              headline: "Not started",
              message: "No activity yet on this project.",
              icon: Shield,
            };
  const Icon = tone.icon;
  const milestonesOk = health === "on-track" || health === "not-started";
  return (
    <section className="rounded-[16px] border border-border bg-card shadow-card">
      <header className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <Icon className={cn("size-4", tone.headerColor)} />
        <h3 className="text-sm font-semibold">Project health</h3>
      </header>
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-start gap-3 rounded-[12px] border border-border bg-background p-3">
          <span
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-full ring-4",
              tone.ring,
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{tone.headline}</p>
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              {tone.message}
            </p>
          </div>
        </div>
        <ul className="space-y-2 text-xs">
          <li className="flex items-center gap-2">
            <CheckCircle2
              className={cn(
                "size-3.5 shrink-0",
                overdueCount === 0 ? "text-emerald-500" : "text-red-500",
              )}
            />
            <span className="text-foreground/80">
              {overdueCount === 0
                ? "No overdue activities"
                : `${overdueCount} overdue activit${overdueCount === 1 ? "y" : "ies"}`}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2
              className={cn(
                "size-3.5 shrink-0",
                dueThisWeek === 0 ? "text-emerald-500" : "text-amber-500",
              )}
            />
            <span className="text-foreground/80">
              {dueThisWeek} activit{dueThisWeek === 1 ? "y" : "ies"} due this week
            </span>
          </li>
          <li className="flex items-center gap-2">
            {milestonesOk ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
            ) : (
              <AlertTriangle
                className={cn(
                  "size-3.5 shrink-0",
                  health === "delayed" ? "text-red-500" : "text-amber-500",
                )}
              />
            )}
            <span className="text-foreground/80">
              {milestonesOk
                ? "Milestones are on track"
                : health === "delayed"
                  ? "Milestones are behind schedule"
                  : "Milestones need attention"}
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}

function UpcomingDeadlinesCard({
  items,
  viewAllHref,
}: {
  items: WVMilestone[];
  viewAllHref: string;
}) {
  return (
    <section className="rounded-[16px] border border-border bg-card shadow-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h3 className="text-sm font-semibold">Upcoming deadlines</h3>
        <Link
          href={viewAllHref}
          className="text-[11.5px] font-medium text-[var(--color-dca-blue-600)] hover:underline"
        >
          View all
        </Link>
      </header>
      {items.length === 0 ? (
        <div className="px-5 py-6 text-center text-xs text-muted-foreground">
          No upcoming deadlines
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-3 px-5 py-3"
            >
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <CalendarDays className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-xs font-semibold">
                  {m.title}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDate(m.date)}
                </p>
              </div>
              <DaysBadge days={m.daysFromNow} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentUpdatesCard({
  items,
  viewAllHref,
}: {
  items: WVUpdate[];
  viewAllHref: string;
}) {
  return (
    <section className="rounded-[16px] border border-border bg-card shadow-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h3 className="text-sm font-semibold">Recent updates</h3>
        <Link
          href={viewAllHref}
          className="text-[11.5px] font-medium text-[var(--color-dca-blue-600)] hover:underline"
        >
          View all
        </Link>
      </header>
      {items.length === 0 ? (
        <div className="px-5 py-6 text-center text-xs text-muted-foreground">
          No recent activity
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((u) => (
            <li key={u.id} className="flex items-start gap-3 px-5 py-3">
              <span
                className={cn(
                  "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md",
                  u.tone === "green" && "bg-emerald-50 text-emerald-600",
                  u.tone === "blue" && "bg-blue-50 text-blue-600",
                  u.tone === "amber" && "bg-amber-50 text-amber-600",
                  u.tone === "gray" && "bg-muted text-muted-foreground",
                )}
              >
                <Paperclip className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-medium leading-snug">
                  {u.text}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  by {u.actor}
                </p>
              </div>
              <span className="shrink-0 text-[10.5px] text-muted-foreground">
                {u.when}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Top-level export ---------------- */

export function WorkspaceView(props: WorkspaceViewProps) {
  return (
    <div className="space-y-6">
      <ProjectHero {...props} />
      <SnapshotStrip {...props} />

      <NextMilestonesCard
        milestones={props.nextMilestones}
        viewAllHref={`/workspace/projects/${props.projectId}`}
        now={props.now}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-9">
          <WorkplanCard phases={props.phases} projectId={props.projectId} />
        </div>
        <aside className="space-y-4 xl:col-span-3">
          <div className="xl:sticky xl:top-[88px] xl:space-y-4">
            <ProjectHealthCard
              health={props.health}
              overdueCount={props.overdueCount}
              dueThisWeek={props.dueThisWeek}
            />
            <UpcomingDeadlinesCard
              items={props.upcomingDeadlines}
              viewAllHref={`/workspace/projects/${props.projectId}`}
            />
            <RecentUpdatesCard
              items={props.recentUpdates}
              viewAllHref={`/workspace/projects/${props.projectId}`}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
