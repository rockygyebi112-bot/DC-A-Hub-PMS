'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArchiveRestore, Check, ListChecks, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  archiveSubtask,
  createSubtask,
  restoreSubtask,
  setTaskStatus,
} from '@/lib/internal/actions';
import type { InternalSubtask } from '@/lib/internal/queries';
import { asTaskStatus } from './task-meta';
import { PermanentDeleteButton } from './permanent-delete-button';
import { cn } from '@/lib/utils';

export function SubtasksCard({
  taskId,
  subtasks,
  isAdmin = false,
}: {
  taskId: string;
  subtasks: InternalSubtask[];
  /** Permanent deletion of an archived subtask is admin-only. */
  isAdmin?: boolean;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const active = subtasks.filter((s) => !s.archived_at);
  const archived = subtasks.filter((s) => s.archived_at);
  const done = active.filter((s) => asTaskStatus(s.status) === 'done').length;

  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListChecks className="size-4" />
          Subtasks
        </h2>
        <div className="flex items-center gap-3">
          {archived.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
            </button>
          )}
          {active.length > 0 && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {done}/{active.length} done
            </span>
          )}
        </div>
      </header>
      <div className="px-3 py-2">
        {active.map((s) => (
          <SubtaskRow key={s.id} taskId={taskId} subtask={s} isAdmin={isAdmin} />
        ))}
        {showArchived &&
          archived.map((s) => (
            <SubtaskRow key={s.id} taskId={taskId} subtask={s} isAdmin={isAdmin} />
          ))}
        <AddSubtask taskId={taskId} />
      </div>
    </section>
  );
}

function SubtaskRow({
  taskId,
  subtask,
  isAdmin,
}: {
  taskId: string;
  subtask: InternalSubtask;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const done = asTaskStatus(subtask.status) === 'done';
  const archived = Boolean(subtask.archived_at);

  function toggle() {
    start(async () => {
      const r = await setTaskStatus(subtask.id, done ? 'not_started' : 'done');
      if (r.ok) router.refresh();
      else toast.error(r.error ?? 'Could not update subtask');
    });
  }

  function remove() {
    start(async () => {
      const r = await archiveSubtask(subtask.id, taskId);
      if (r.ok) router.refresh();
      else toast.error(r.error ?? 'Could not delete subtask');
    });
  }

  function restore() {
    start(async () => {
      const r = await restoreSubtask(subtask.id, taskId);
      if (r.ok) router.refresh();
      else toast.error(r.error ?? 'Could not restore subtask');
    });
  }

  return (
    <div
      className={cn(
        'group/sub flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/40',
        archived && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={pending || archived}
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
      {archived && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Archived
        </span>
      )}
      <button
        type="button"
        onClick={archived ? restore : remove}
        disabled={pending}
        aria-label={archived ? 'Restore subtask' : 'Delete subtask'}
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded text-muted-foreground transition disabled:opacity-50',
          archived
            ? 'hover:bg-muted hover:text-foreground'
            : 'opacity-0 hover:bg-muted hover:text-destructive group-hover/sub:opacity-100',
        )}
      >
        {archived ? (
          <ArchiveRestore className="size-3.5" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </button>
      {archived && isAdmin && (
        <PermanentDeleteButton
          target="task"
          id={subtask.id}
          name={subtask.title}
          parentId={taskId}
        />
      )}
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
