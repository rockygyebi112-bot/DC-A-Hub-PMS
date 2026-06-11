'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { createTask } from '@/lib/internal/actions';
import { cn } from '@/lib/utils';
import type { TaskStatus } from './task-meta';

/**
 * Asana-style inline task creation: click "Add task", type a name, press Enter.
 * No title form — the task is created immediately under its section and can be
 * opened for details afterwards. Enter keeps the field open to add several.
 */
export function InlineAddTask({
  areaId,
  status = 'not_started',
  variant = 'list',
}: {
  areaId: string;
  status?: TaskStatus;
  variant?: 'list' | 'board';
}) {
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
      const fd = new FormData();
      fd.set('title', title);
      fd.set('area_id', areaId);
      fd.set('status', status);
      const r = await createTask(fd);
      if (!r.ok) {
        toast.error(r.error ?? 'Could not create task');
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
        className={cn(
          'inline-flex w-full items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
          variant === 'list' ? 'h-8 px-0' : 'justify-start rounded-md px-2 py-1.5 hover:bg-muted/60',
        )}
      >
        <Plus className="size-4" />
        Add task
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      autoFocus
      value={value}
      disabled={pending}
      placeholder="Task name, then Enter"
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
      className={cn(
        'w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20',
        variant === 'board' ? 'h-9' : 'h-8',
      )}
    />
  );
}
