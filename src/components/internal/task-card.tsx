import Link from 'next/link';

import { Badge } from '@/components/ui/badge';

// Shape mirrors `InternalTaskWithAssignees` from `@/lib/internal/queries`:
// the DB column is plain text (no enum) so `status`/`priority` come back as
// `string`, and the two-step assignee hydration yields
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

const statusStyle: Record<string, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  blocked: 'bg-red-500/15 text-red-600 dark:text-red-400',
  done: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};

const priorityVariant: Record<
  string,
  'neutral' | 'info' | 'warning' | 'destructive'
> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'destructive',
};

function formatDue(iso: string): string {
  // ISO date (YYYY-MM-DD) — parse as local to avoid TZ off-by-one.
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function TaskCard({ task }: { task: TaskRow }) {
  const pillClass =
    statusStyle[task.status] ?? 'bg-muted text-muted-foreground';
  const assignees = (task.assignees ?? []).filter((a) => a.profile);
  const visible = assignees.slice(0, 3);
  const overflow = assignees.length - visible.length;

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const overdue =
    !!task.due_date && task.status !== 'done' && task.due_date < todayIso;

  return (
    <Link
      href={`/workspace/internal/${task.id}`}
      className="block rounded-md border border-border bg-card p-3 shadow-sm transition-colors hover:border-foreground/30"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{task.title}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${pillClass}`}
        >
          {task.status.replace('_', ' ')}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${
              overdue ? 'font-medium text-destructive' : 'text-muted-foreground'
            }`}
          >
            {task.due_date ? formatDue(task.due_date) : 'No due date'}
          </span>
          {task.priority && priorityVariant[task.priority] && (
            <Badge variant={priorityVariant[task.priority]}>
              {task.priority}
            </Badge>
          )}
        </div>
        {assignees.length > 0 ? (
          <div className="flex items-center -space-x-2">
            {visible.map((a) =>
              a.profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={a.user_id}
                  src={a.profile.avatar_url}
                  alt={a.profile.full_name ?? ''}
                  className="size-6 rounded-full object-cover ring-2 ring-card"
                />
              ) : (
                <span
                  key={a.user_id}
                  className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground ring-2 ring-card"
                >
                  {initials(a.profile?.full_name ?? null)}
                </span>
              ),
            )}
            {overflow > 0 && (
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground ring-2 ring-card">
                +{overflow}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
      </div>
    </Link>
  );
}
