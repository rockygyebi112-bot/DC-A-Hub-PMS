'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { archiveArea, createArea, updateArea } from '@/lib/internal/actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Section = the internal "area" repurposed as an Asana-style section. These
 * controls let admins create, rename and delete (archive) sections inline from
 * the board/list, so the grouping is user-managed rather than a fixed taxonomy.
 */
export function SectionHeading({
  id,
  name,
  count,
  color,
  canManage,
}: {
  id: string;
  name: string;
  count: number;
  color?: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, start] = useTransition();

  function rename() {
    const next = value.trim();
    if (!next || next === name) {
      setEditing(false);
      setValue(name);
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set('name', next);
      const r = await updateArea(id, fd);
      if (r.ok) {
        toast.success('Section renamed');
        setEditing(false);
        router.refresh();
      } else {
        toast.error(r.error ?? 'Could not rename section');
      }
    });
  }

  function remove() {
    if (!window.confirm(`Delete section “${name}”? Move its tasks out first if it isn't empty.`)) {
      return;
    }
    start(async () => {
      const r = await archiveArea(id);
      if (r.ok) {
        toast.success('Section deleted');
        router.refresh();
      } else {
        toast.error(r.error ?? 'Could not delete section');
      }
    });
  }

  if (editing) {
    return (
      <span className="flex items-center gap-1.5">
        <input
          autoFocus
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') rename();
            if (e.key === 'Escape') {
              setEditing(false);
              setValue(name);
            }
          }}
          className="h-7 w-44 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={rename}
          disabled={pending}
          aria-label="Save section name"
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue(name);
          }}
          aria-label="Cancel"
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      {color && (
        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      )}
      <span className="truncate text-sm font-semibold text-foreground">{name}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Section options"
                className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/sec:opacity-100 group-hover/col:opacity-100"
              >
                <MoreHorizontal className="size-4" />
              </button>
            }
          />
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={remove} className="text-destructive">
              <Trash2 className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </span>
  );
}

export function AddSection({ variant = 'list' }: { variant?: 'list' | 'board' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [pending, start] = useTransition();

  function submit() {
    const name = value.trim();
    if (!name) return;
    start(async () => {
      const fd = new FormData();
      fd.set('name', name);
      const r = await createArea(fd);
      if (r.ok) {
        toast.success('Section created');
        setValue('');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(r.error ?? 'Could not create section');
      }
    });
  }

  if (open) {
    return (
      <span className="flex items-center gap-1.5">
        <input
          autoFocus
          value={value}
          placeholder="Section name"
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') {
              setOpen(false);
              setValue('');
            }
          }}
          className="h-8 w-44 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim()}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setValue('');
          }}
          aria-label="Cancel"
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
        variant === 'board' &&
          'w-full justify-center rounded-xl border border-dashed border-border py-2.5 hover:border-primary/50 hover:bg-muted/30',
      )}
    >
      <Plus className="size-4" />
      Add section
    </button>
  );
}
