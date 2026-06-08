import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Flag,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { TASK_PRIORITY_META, type TaskPriority } from "./task-meta";

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

export type TaskCardArea = { name: string; color?: string | null };
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

function relativeDate(value?: string | null): string | null {
  if (!value) return null;
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return null;
  const diff = Date.now() - then.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TaskCard({
  task,
  area,
  project,
}: {
  task: TaskRow;
  area?: TaskCardArea;
  project?: TaskCardProject;
}) {
  const assignees = (task.assignees ?? []).filter((a) => a.profile);
  const visible = assignees.slice(0, 3);
  const overflow = assignees.length - visible.length;
  const updated = relativeDate(task.updated_at);

  const overdue =
    !!task.due_date && task.status !== "done" && task.due_date < todayIso();

  const priority =
    task.priority && task.priority in TASK_PRIORITY_META
      ? TASK_PRIORITY_META[task.priority as TaskPriority]
      : null;

  return (
    <Link
      href={`/workspace/internal/${task.id}`}
      className={cn(
        "group block overflow-hidden rounded-md border border-border bg-card transition-colors",
        "hover:border-primary/40 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        overdue && "border-destructive/30",
      )}
    >
      <div
        className={cn(
          "h-1 w-full bg-muted",
          task.priority === "urgent" && "bg-destructive",
          task.priority === "high" && "bg-amber-500",
          task.priority === "normal" && "bg-blue-500",
          task.priority === "low" && "bg-muted-foreground/45",
        )}
      />
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {task.title}
            </h3>
            {task.description && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {task.description}
              </p>
            )}
          </div>
          {priority && (
            <Badge variant={priority.variant} className="shrink-0 gap-1 rounded-md px-1.5 py-0.5">
              <Flag className="size-3" />
              <span className="sr-only sm:not-sr-only">{priority.label}</span>
            </Badge>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {project && (
            <CardMeta icon={BriefcaseBusiness}>
              {project.client?.name ? `${project.name} - ${project.client.name}` : project.name}
            </CardMeta>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            {area && (
              <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full bg-muted-foreground/50"
                  style={area.color ? { backgroundColor: area.color } : undefined}
                />
                <span className="truncate">{area.name}</span>
              </span>
            )}
            {task.due_date && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 text-xs",
                  overdue ? "font-medium text-destructive" : "text-muted-foreground",
                )}
              >
                {overdue ? <AlertTriangle className="size-3" /> : <CalendarDays className="size-3" />}
                {formatDue(task.due_date)}
              </span>
            )}
            {updated && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="size-3" />
                {updated}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex min-h-7 items-center justify-between gap-2 border-t border-border/70 pt-3">
          {assignees.length > 0 ? (
            <div className="flex shrink-0 items-center -space-x-2">
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
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card">
                  +{overflow}
                </span>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
              <UserRound className="size-3" />
              No owner
            </span>
          )}
          <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Open
          </span>
        </div>
      </div>
    </Link>
  );
}

function CardMeta({
  icon: Icon,
  children,
}: {
  icon: typeof BriefcaseBusiness;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}
