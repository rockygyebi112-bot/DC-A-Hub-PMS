'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ListChecks, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { createSubtask, deleteSubtask, setTaskStatus } from '@/lib/internal/actions';
import type { InternalSubtask } from '@/lib/internal/queries';
import { asTaskStatus } from './task-meta';
import { cn } from '@/lib/utils';

export function SubtasksCard({
  taskId,
  subtasks,
}: {
  taskId: string;
  subtasks: InternalSubtask[];
}) {
  const done = subtasks.filter((s) => asTaskStatus(s.status) === 'done').length;

  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListChecks className="size-4" />
          Subtasks
        </h2>
        {subtasks.length > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {done}/{subtasks.length} done
          </span>
        )}
      </header>
      <div className="px-3 py-2">
        {subtasks.map((s) => (
          <SubtaskRow key={s.id} taskId={taskId} subtask={s} />
        ))}
        <AddSubtask taskId={taskId} />
      </div>
    </section>
  );
}

function SubtaskRow({
  taskId,
  subtask,
}: {
  taskId: string;
  subtask: InternalSubtask;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const done = asTaskStatus(subtask.status) === 'done';

  function toggle() {
    start(async () => {
      const r = await setTaskStatus(subtask.id, done ? 'not_started' : 'done');
      if (r.ok) router.refresh();
      else toast.error(r.error ?? 'Could not update subtask');
    });
  }

  function remove() {
    start(async () => {
      const r = await deleteSubtask(subtask.id, taskId);
      if (r.ok) router.refresh();
      else toast.error(r.error ?? 'Could not delete subtask');
    });
  }

  return (
    <div className="group/sub flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/40">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={done ? 'Mark subtask incomplete' : 'Mark subtask complete'}
        className={cn(
          'grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors',
          done
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-muted-foreground/40 text-transparent hover:border-emerald-500 hover:text-emerald-500',
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </button>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm text-foreground',
          done && 'text-muted-foreground line-through',
        )}
      >
        {subtask.title}
      </span>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label="Delete subtask"
        className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive group-hover/sub:opacity-100 disabled:opacity-50"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function AddSubtask({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(keepOpen: boolean) {
    const title = value.trim();
    if (!title) {
      if (!keepOpen) setOpen(false);
      return;
    }
    start(async () => {
      const r = await createSubtask(taskId, title);
      if (!r.ok) {
        toast.error(r.error ?? 'Could not add subtask');
        return;
      }
      setValue('');
      router.refresh();
      if (keepOpen) inputRef.current?.focus();
      else setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-0.5 inline-flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="size-4" />
        Add subtask
      </button>
    );
  }

  return (
    <div className="px-2 py-1">
      <input
        ref={inputRef}
        autoFocus
        value={value}
        disabled={pending}
        placeholder="Subtask name, then Enter"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit(true);
          }
          if (e.key === 'Escape') {
            setValue('');
            setOpen(false);
          }
        }}
        onBlur={() => submit(false)}
        className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
