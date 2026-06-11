import Link from "next/link";
import { AlertTriangle, CalendarDays, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { cn } from "@/lib/utils";
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  asTaskStatus,
  type TaskPriority,
  type TaskStatus,
} from "./task-meta";

export type TaskRow = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string | null;
  due_date?: string | null;
  project_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  assignees?:
    | {
        user_id: string;
        profile: {
          user_id: string;
          full_name: string | null;
          avatar_url: string | null;
        } | null;
      }[]
    | null;
};

export type TaskCardProject = { name: string; client?: { name: string } | null };

function formatDue(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate(),
  ).padStart(2, "0")}`;
}

function statusDot(status: TaskStatus) {
  if (status === "in_progress") return "bg-blue-500";
  if (status === "blocked") return "bg-red-500";
  if (status === "done") return "bg-emerald-500";
  return "bg-slate-400";
}

function statusPill(status: TaskStatus) {
  if (status === "in_progress") return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (status === "blocked") return "bg-red-500/10 text-red-600 dark:text-red-400";
  if (status === "done") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  return "bg-muted text-muted-foreground";
}

export function TaskCard({
  task,
  project,
}: {
  task: TaskRow;
  project?: TaskCardProject;
}) {
  const assignees = (task.assignees ?? []).filter((a) => a.profile);
  const visible = assignees.slice(0, 3);
  const overflow = assignees.length - visible.length;

  const status = asTaskStatus(task.status);
  const statusMeta = TASK_STATUS_META[status];
  const overdue = !!task.due_date && status !== "done" && task.due_date < todayIso();

  const priority =
    task.priority && task.priority in TASK_PRIORITY_META
      ? TASK_PRIORITY_META[task.priority as TaskPriority]
      : null;

  return (
    <Link
      href={`/workspace/internal/${task.id}`}
      className={cn(
        "group block rounded-lg border border-border/60 bg-card p-3 shadow-sm transition-colors duration-150",
        "hover:border-border hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
        {task.title}
      </h3>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
              statusPill(status),
            )}
          >
            <span className={cn("size-1.5 rounded-full", statusDot(status))} />
            {statusMeta.label}
          </span>
          {task.due_date && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1",
                overdue && "font-medium text-red-600",
              )}
            >
              {overdue ? <AlertTriangle className="size-3" /> : <CalendarDays className="size-3" />}
              {formatDue(task.due_date)}
            </span>
          )}
          {project && (
            <span className="min-w-0 truncate">
              {project.client?.name ? `${project.name} · ${project.client.name}` : project.name}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {priority && priority.variant !== "info" && priority.variant !== "neutral" && (
            <Badge variant={priority.variant} className="rounded px-1.5 py-0 text-[10px]">
              {priority.label}
            </Badge>
          )}
          {assignees.length > 0 ? (
            <div className="flex shrink-0 items-center -space-x-1.5">
              {visible.map((a) => (
                <UserAvatar
                  key={a.user_id}
                  email={a.user_id}
                  name={a.profile?.full_name ?? "Unknown"}
                  avatarUrl={a.profile?.avatar_url}
                  size="sm"
                  className="ring-2 ring-card"
                />
              ))}
              {overflow > 0 && (
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card">
                  +{overflow}
                </span>
              )}
            </div>
          ) : (
            <span
              className="grid size-6 place-items-center rounded-full border border-dashed border-border text-muted-foreground"
              title="Unassigned"
            >
              <UserRound className="size-3" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
