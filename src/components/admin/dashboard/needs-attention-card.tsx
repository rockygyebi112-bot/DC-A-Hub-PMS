import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskRow } from "./tasks-overview";

export type AttentionItem = TaskRow & {
  reason: "overdue" | "due_soon";
};

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const today = new Date();
  const due = new Date(value);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function reasonLabel(item: AttentionItem) {
  if (item.reason === "overdue") {
    const days = daysUntil(item.dueDate);
    if (days === null) return "Overdue";
    const overdueDays = Math.abs(days);
    return overdueDays === 0
      ? "Due today"
      : `${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue`;
  }

  const days = daysUntil(item.dueDate);
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return days === null ? "Due soon" : `Due in ${days} days`;
}

const PRIORITY_CLASS: Record<AttentionItem["priority"], string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

export function NeedsAttentionCard({
  items,
  counts,
  viewAllHref,
}: {
  items: AttentionItem[];
  counts: { overdue: number; due_week: number };
  viewAllHref?: string;
}) {
  const total = counts.overdue + counts.due_week;

  return (
    <div className="rounded-[var(--admin-card-radius)] border bg-card shadow-card">
      <header className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Priority queue
          </p>
          <h2 className="mt-1 font-heading text-base font-semibold tracking-tight">
            Needs Attention
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {total > 0
              ? `${counts.overdue} overdue and ${counts.due_week} due this week.`
              : "No urgent activity deadlines right now."}
          </p>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs font-medium text-primary hover:underline"
          >
            Review tasks
          </Link>
        )}
      </header>
      <div className="border-t px-4 pb-4 pt-3 sm:px-5">
        {items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 text-sm text-muted-foreground">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            <span>Everything scheduled for this week is under control.</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const isOverdue = item.reason === "overdue";
              const Icon = isOverdue ? AlertTriangle : CalendarClock;
              return (
                <li key={`${item.reason}-${item.id}`}>
                  <Link
                    href={`/admin/projects/${item.projectId}`}
                    className="flex items-start gap-3 rounded-2xl border bg-background px-3 py-3 transition-colors hover:bg-muted/60"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        isOverdue
                          ? "bg-red-500/10 text-red-600"
                          : "bg-amber-500/10 text-amber-600",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{item.title}</span>
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            PRIORITY_CLASS[item.priority],
                          )}
                        />
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {item.projectName}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={cn(
                          "block text-xs font-semibold",
                          isOverdue ? "text-red-600" : "text-amber-600",
                        )}
                      >
                        {reasonLabel(item)}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {formatDate(item.dueDate)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
