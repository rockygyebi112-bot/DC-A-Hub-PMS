'use client';

import { useState, useTransition } from 'react';
import { createTask } from '@/lib/internal/actions';

export function NewTaskForm({ areas }: { areas: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onSubmit(fd: FormData) {
    setError(null);
    start(async () => {
      const r = await createTask(fd);
      if (!r.ok) setError(r.error);
      else setOpen(false);
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-gray-900 px-3 py-2 text-sm text-white">
        + New task
      </button>
    );
  }

  return (
    <form action={onSubmit} className="space-y-2 rounded-md border bg-white p-4 shadow-sm">
      <select name="area_id" required className="w-full rounded border px-2 py-1 text-sm">
        <option value="">Choose area…</option>
        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <input name="title" required placeholder="Task title" className="w-full rounded border px-2 py-1 text-sm" />
      <textarea name="description" placeholder="Description (optional)" className="w-full rounded border px-2 py-1 text-sm" />
      <div className="flex gap-2">
        <select name="priority" defaultValue="" className="rounded border px-2 py-1 text-sm">
          <option value="">No priority</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <input name="due_date" type="date" className="rounded border px-2 py-1 text-sm" />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-gray-900 px-3 py-1 text-sm text-white">
          {pending ? 'Saving…' : 'Create'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-3 py-1 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
