import Link from "next/link";
import { CalendarDays, CircleCheck, Flag } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { TASK_PRIORITY_META, type TaskPriority } from "./task-meta";

// Shape mirrors `InternalTaskWithAssignees` from `@/lib/internal/queries`: the
// DB columns are plain text, and the two-step assignee hydration yields
// `{ user_id, profile: {...} | null }` per row.
export type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority?: string | null;
  due_date?: string | null;
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

function formatDue(iso: string): string {
  // Parse the ISO date (YYYY-MM-DD) as local to avoid a TZ off-by-one.
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

export function TaskCard({
  task,
  area,
}: {
  task: TaskRow;
  area?: TaskCardArea;
}) {
  const assignees = (task.assignees ?? []).filter((a) => a.profile);
  const visible = assignees.slice(0, 3);
  const overflow = assignees.length - visible.length;

  const overdue =
    !!task.due_date && task.status !== "done" && task.due_date < todayIso();

  const priority =
    task.priority && task.priority in TASK_PRIORITY_META
      ? TASK_PRIORITY_META[task.priority as TaskPriority]
      : null;

  return (
    <Link
      href={`/workspace/internal/${task.id}`}
      className="group block rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground/55 group-hover:text-primary" />
          <h3 className="line-clamp-3 text-sm font-medium leading-snug text-foreground">
            {task.title}
          </h3>
        </div>
        {priority && (
          <Badge variant={priority.variant} className="shrink-0 gap-1 rounded-sm px-1.5 py-0.5">
            <Flag className="size-3" />
            <span className="sr-only sm:not-sr-only">{priority.label}</span>
          </Badge>
        )}
      </div>

      <div className="mt-3 space-y-3 pl-6">
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
                overdue
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}
            >
              <CalendarDays className="size-3" />
              {formatDue(task.due_date)}
            </span>
          )}
        </div>

        {assignees.length > 0 && (
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
        )}
      </div>
    </Link>
  );
}
