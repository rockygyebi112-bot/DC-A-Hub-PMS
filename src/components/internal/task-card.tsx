import Link from 'next/link';

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
  assignees?: {
    user_id: string;
    profile: {
      user_id: string;
      full_name: string | null;
      avatar_url: string | null;
    } | null;
  }[] | null;
};

const statusStyle: Record<string, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  blocked: 'bg-red-500/15 text-red-600 dark:text-red-400',
  done: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};

export function TaskCard({ task }: { task: TaskRow }) {
  const pillClass = statusStyle[task.status] ?? 'bg-muted text-muted-foreground';
  return (
    <Link href={`/workspace/internal/${task.id}`}
      className="block rounded-md border border-border bg-card p-3 shadow-sm hover:border-foreground/30">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{task.title}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${pillClass}`}>
          {task.status.replace('_', ' ')}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{task.due_date ?? 'No due date'}</span>
        <span>{(task.assignees ?? []).length} assigned</span>
      </div>
    </Link>
  );
}
