import Link from "next/link";
import { Check } from "lucide-react";
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
  tasks,
  counts,
  activeFilter = "all",
  viewAllHref,
}: {
  tasks: TaskRow[];
  counts: { all: number; overdue: number; due_week: number; completed: number };
  activeFilter?: Filter;
  viewAllHref?: string;
}) {
  const pills: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "overdue", label: "Overdue", count: counts.overdue },
    { key: "due_week", label: "Due This Week", count: counts.due_week },
    { key: "completed", label: "Completed", count: counts.completed },
  ];

  return (
    <div className="rounded-[var(--admin-card-radius)] border bg-card shadow-card">
      <header className="flex items-center justify-between gap-3 px-5 py-4">
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
      <div className="px-5">
        <div className="flex flex-wrap gap-2 pb-3">
          {pills.map((pill) => {
            const active = pill.key === activeFilter;
            return (
              <button
                key={pill.key}
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
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
            return (
              <li
                key={task.id}
                className="flex items-start justify-between gap-4 px-5 py-3.5"
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
                    {task.isCompleted && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        task.isCompleted && "text-muted-foreground line-through",
                      )}
                    >
                      {task.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {task.projectName}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        PRIORITY_COLOR[task.priority].dot,
                      )}
                    />
                    {PRIORITY_COLOR[task.priority].label}
                  </span>
                  {due && (
                    <span
                      className={cn(
                        "text-[11px]",
                        task.isOverdue
                          ? "font-medium text-[hsl(0_78%_42%)]"
                          : "text-muted-foreground",
                      )}
                    >
                      Due: {due}
                    </span>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
