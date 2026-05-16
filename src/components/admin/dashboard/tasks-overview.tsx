"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskRow = {
  id: string;
  title: string;
  projectName: string;
  projectId: string;
  priority: "high" | "medium" | "low";
  dueDate: string | null;
  isCompleted: boolean;
  isOverdue: boolean;
};

type Filter = "all" | "overdue" | "due_week" | "completed";

export type TasksByFilter = Record<Filter, TaskRow[]>;

const PRIORITY_COLOR: Record<TaskRow["priority"], { dot: string; label: string }> = {
  high: { dot: "bg-[hsl(0_78%_56%)]", label: "High Priority" },
  medium: { dot: "bg-[hsl(38_92%_50%)]", label: "Medium Priority" },
  low: { dot: "bg-[hsl(160_64%_42%)]", label: "Low Priority" },
};

function formatDue(date: string | null) {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

export function TasksOverview({
  tasksByFilter,
  counts,
  defaultFilter = "all",
  viewAllHref,
}: {
  tasksByFilter: TasksByFilter;
  counts: { all: number; overdue: number; due_week: number; completed: number };
  defaultFilter?: Filter;
  viewAllHref?: string;
}) {
  const [activeFilter, setActiveFilter] = useState<Filter>(defaultFilter);
  const [projectFilter, setProjectFilter] = useState<string>("all");

  // Unique project list aggregated across every filter bucket so the
  // dropdown shows the same options regardless of which pill is active.
  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const key of ["all", "overdue", "due_week", "completed"] as Filter[]) {
      for (const task of tasksByFilter[key] ?? []) {
        if (!seen.has(task.projectId)) seen.set(task.projectId, task.projectName);
      }
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasksByFilter]);

  const bucket = tasksByFilter[activeFilter] ?? [];
  const tasks =
    projectFilter === "all"
      ? bucket
      : bucket.filter((t) => t.projectId === projectFilter);
  // When the user has narrowed to a single project, the per-row project
  // line is redundant — the dropdown already communicates the scope.
  const showProjectPerRow = projectFilter === "all";

  // Counts on the filter pills should reflect the current project scope so
  // users aren't misled into clicking a non-empty pill that becomes empty
  // after project filtering.
  const filteredCounts = useMemo(() => {
    if (projectFilter === "all") return counts;
    const tally = (key: Filter) =>
      (tasksByFilter[key] ?? []).filter((t) => t.projectId === projectFilter)
        .length;
    return {
      all: tally("all"),
      overdue: tally("overdue"),
      due_week: tally("due_week"),
      completed: tally("completed"),
    };
  }, [counts, projectFilter, tasksByFilter]);

  const pills: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: filteredCounts.all },
    { key: "overdue", label: "Overdue", count: filteredCounts.overdue },
    { key: "due_week", label: "Due This Week", count: filteredCounts.due_week },
    { key: "completed", label: "Completed", count: filteredCounts.completed },
  ];

  return (
    <div className="overflow-hidden rounded-[var(--admin-card-radius)] border bg-card shadow-card">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Tasks Overview
        </h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all tasks
          </Link>
        )}
      </header>
      <div className="px-4 sm:px-5">
        {/* Horizontal scroll on mobile so the project dropdown + four filter
            pills don't force the card wider than the viewport. Negative
            inline margin lets the scroll area bleed to the card edges. */}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-3 sm:mx-0 sm:flex-wrap sm:px-0">
          {projectOptions.length > 0 && (
            <label className="relative inline-flex shrink-0 items-center">
              <span className="sr-only">Filter by project</span>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className={cn(
                  "max-w-[140px] appearance-none truncate rounded-full border border-border bg-background py-1.5 pl-3 pr-8 text-xs font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring/40 sm:max-w-none",
                  projectFilter !== "all" &&
                    "border-[var(--color-dca-navy-900)] bg-[var(--color-dca-navy-900)] text-white hover:bg-[var(--color-dca-navy-900)]",
                )}
              >
                <option value="all">All projects</option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className={cn(
                  "pointer-events-none absolute right-2 size-3.5",
                  projectFilter !== "all" ? "text-white" : "text-muted-foreground",
                )}
              />
            </label>
          )}
          {pills.map((pill) => {
            const active = pill.key === activeFilter;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setActiveFilter(pill.key)}
                aria-pressed={active}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-[var(--color-dca-navy-900)] bg-[var(--color-dca-navy-900)] text-white"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                <span>{pill.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-mono tabular-nums",
                    active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <ul className="divide-y border-t">
        {tasks.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted-foreground">
            No tasks to show.
          </li>
        ) : (
          tasks.map((task) => {
            const due = formatDue(task.dueDate);
            const priority = PRIORITY_COLOR[task.priority];
            return (
              <li key={task.id}>
                <Link
                  href={`/admin/projects/${task.projectId}`}
                  className="flex items-start justify-between gap-3 px-4 py-3.5 transition-colors active:bg-muted/60 sm:gap-4 sm:px-5"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        task.isCompleted
                          ? "border-[hsl(160_64%_42%)] bg-[hsl(160_64%_42%)] text-white"
                          : "border-border bg-background",
                      )}
                    >
                      {task.isCompleted && (
                        <Check className="size-3" strokeWidth={3} />
                      )}
                    </span>
                    <div className="min-w-0">
                      {/* line-clamp-2 instead of truncate — task titles are
                          the meat of this card; wrapping to two lines is
                          friendlier than chopping the end ("Build and submit
                          Cohort Enrollment & Attendance…"). */}
                      <p
                        className={cn(
                          "line-clamp-2 text-sm font-medium leading-snug",
                          task.isCompleted &&
                            "text-muted-foreground line-through",
                        )}
                      >
                        {task.title}
                      </p>
                      {showProjectPerRow && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {task.projectName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
                      aria-label={priority.label}
                      title={priority.label}
                    >
                      <span
                        className={cn("size-1.5 rounded-full", priority.dot)}
                      />
                      {/* Hide the priority text on phones to save horizontal room;
                          the dot color still conveys the priority. */}
                      <span className="hidden sm:inline">
                        {priority.label}
                      </span>
                    </span>
                    {due && (
                      <span
                        className={cn(
                          "text-[11px] whitespace-nowrap",
                          task.isOverdue
                            ? "font-medium text-[hsl(0_78%_42%)]"
                            : "text-muted-foreground",
                        )}
                      >
                        <span className="hidden sm:inline">Due: </span>
                        {due}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
