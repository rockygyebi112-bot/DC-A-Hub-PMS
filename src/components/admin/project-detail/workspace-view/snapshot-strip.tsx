import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Shield,
  TrendingUp,
  Activity as ActivityIcon,
  Users,
} from "lucide-react";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import {
  ProgressDonut,
  formatDate,
  formatCurrency,
} from "@/components/admin/project-detail/parts";
import { cn } from "@/lib/utils";
import { DaysBadge } from "./badges";
import type { WorkspaceViewProps } from "./types";

export function SnapshotStrip(props: WorkspaceViewProps) {
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
              Client view: {props.clientDoneCount} / {props.clientTotalCount}
              <br />
              activities completed
            </p>
            {props.totalCount !== props.clientTotalCount && (
              <p className="text-[11px] leading-tight text-amber-700 dark:text-amber-300">
                Overall (includes internal): {props.doneCount} / {props.totalCount}
              </p>
            )}
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
