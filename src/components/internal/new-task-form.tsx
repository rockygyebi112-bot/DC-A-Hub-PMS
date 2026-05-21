'use client';

import { useState, useTransition } from 'react';
import { createTask } from '@/lib/internal/actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function NewTaskForm({ areas }: { areas: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Base UI Select has no empty-string item value; use a "__none" sentinel for
  // the trigger and feed the real "" back through a hidden input for submission.
  const [priority, setPriority] = useState("");

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
      <button onClick={() => setOpen(true)} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
        + New task
      </button>
    );
  }

  return (
    <form action={onSubmit} className="space-y-2 rounded-md border bg-card p-4 shadow-sm">
      <Select name="area_id" required>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue placeholder="Choose area…" />
        </SelectTrigger>
        <SelectContent>
          {areas.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input name="title" required placeholder="Task title" className="w-full rounded border bg-background text-foreground px-2 py-1 text-sm" />
      <textarea name="description" placeholder="Description (optional)" className="w-full rounded border bg-background text-foreground px-2 py-1 text-sm" />
      <div className="flex gap-2">
        <input type="hidden" name="priority" value={priority} />
        <Select
          value={priority || "__none"}
          onValueChange={(v) => setPriority(v === "__none" ? "" : (v ?? ""))}
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">No priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <input name="due_date" type="date" className="rounded border bg-background text-foreground px-2 py-1 text-sm" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">
          {pending ? 'Saving…' : 'Create'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-3 py-1 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
