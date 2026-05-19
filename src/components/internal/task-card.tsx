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
  not_started: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  blocked: 'bg-red-100 text-red-700',
  done: 'bg-emerald-100 text-emerald-700',
};

export function TaskCard({ task }: { task: TaskRow }) {
  const pillClass = statusStyle[task.status] ?? 'bg-gray-100 text-gray-700';
  return (
    <Link href={`/workspace/internal/${task.id}`}
      className="block rounded-md border border-gray-200 bg-white p-3 shadow-sm hover:border-gray-300">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900">{task.title}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${pillClass}`}>
          {task.status.replace('_', ' ')}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>{task.due_date ?? 'No due date'}</span>
        <span>{(task.assignees ?? []).length} assigned</span>
      </div>
    </Link>
  );
}
