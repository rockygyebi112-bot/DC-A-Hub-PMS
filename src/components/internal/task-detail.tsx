'use client';

import { useTransition } from 'react';
import {
  setTaskStatus,
  updateTask,
  addAssignee,
  removeAssignee,
} from '@/lib/internal/actions';
import { AssigneePicker } from './assignee-picker';

// Shape mirrors `InternalTaskWithAssignees` from `@/lib/internal/queries`:
// the DB column is plain text (no enum) so `status` comes back as `string`,
// and the hydrated assignee row carries the full profile projection.
type Assignee = {
  user_id: string;
  profile: {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  area_id: string;
  project_id?: string | null;
  status: string;
  priority?: string | null;
  due_date?: string | null;
  assignees?: Assignee[] | null;
};

// `setTaskStatus` is typed against the DB enum literal; the <select> only emits
// these four values, so the narrowing is sound at runtime.
type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'done';

export function TaskDetail({
  task,
  areas,
}: {
  task: Task;
  areas: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();

  // Server actions return `ActionResult`, but `useTransition`'s start callback
  // requires a void-returning function. Run the action, surface failures to the
  // console (toast plumbing is a follow-up), and discard the resolved value.
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    start(() => {
      void fn().then((r) => {
        if (!r.ok) console.error('[internal task] action failed:', r.error);
      });
    });
  };

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {areas.find((a) => a.id === task.area_id)?.name ?? 'Area'}
        </div>
        <h1 className="text-2xl font-semibold">{task.title}</h1>
      </header>

      <section className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <label className="block text-xs text-gray-500">Status</label>
          <select
            defaultValue={task.status}
            onChange={(e) =>
              run(() => setTaskStatus(task.id, e.target.value as TaskStatus))
            }
            disabled={pending}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Due date</label>
          <form action={(fd) => run(() => updateTask(task.id, fd))}>
            <input
              name="due_date"
              type="date"
              defaultValue={task.due_date ?? ''}
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </form>
        </div>
      </section>

      <section>
        <label className="block text-xs text-gray-500">Description</label>
        <form action={(fd) => run(() => updateTask(task.id, fd))}>
          <textarea
            name="description"
            defaultValue={task.description ?? ''}
            className="mt-1 w-full rounded border p-2 text-sm"
            rows={6}
          />
          <button
            className="mt-2 rounded-md bg-gray-900 px-3 py-1 text-sm text-white"
            disabled={pending}
          >
            Save description
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Assignees</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(task.assignees ?? []).map((a) => (
            <li
              key={a.user_id}
              className="flex items-center justify-between rounded border px-2 py-1"
            >
              <span>{a.profile?.full_name ?? a.user_id}</span>
              <button
                onClick={() => run(() => removeAssignee(task.id, a.user_id))}
                disabled={pending}
                className="text-xs text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <AssigneePicker
          existingIds={(task.assignees ?? []).map((a) => a.user_id)}
          onAdd={(userId) => run(() => addAssignee(task.id, userId))}
        />
      </section>
    </article>
  );
}
