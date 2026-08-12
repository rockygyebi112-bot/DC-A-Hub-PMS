'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArchiveRestore,
  Check,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  archiveArea,
  countSectionTasks,
  createArea,
  restoreArea,
  updateArea,
} from '@/lib/internal/actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
  canArchive = false,
  archived = false,
}: {
  id: string;
  name: string;
  count: number;
  color?: string | null;
  canManage: boolean;
  /** Archiving cascades to every task in the section, so it is admin-only. */
  canArchive?: boolean;
  archived?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [pending, start] = useTransition();

  // Counted when the dialog opens rather than passed in: the board's own count
  // reflects the active status/project filters, and the confirmation has to
  // speak for everything that will actually be archived.
  useEffect(() => {
    if (!confirmOpen) return;
    let cancelled = false;
    countSectionTasks(id).then((r) => {
      if (!cancelled && r.ok) setTaskCount(r.data?.count ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [confirmOpen, id]);

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

  function confirmArchive() {
    start(async () => {
      const r = await archiveArea(id);
      if (r.ok) {
        toast.success('Section archived');
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(r.error ?? 'Could not archive section');
      }
    });
  }

  function restore() {
    start(async () => {
      const r = await restoreArea(id);
      if (r.ok) {
        toast.success('Section restored');
        router.refresh();
      } else {
        toast.error(r.error ?? 'Could not restore section');
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
      <span
        className={cn(
          'truncate text-sm font-semibold text-foreground',
          archived && 'text-muted-foreground line-through',
        )}
      >
        {name}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      {archived && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Archived
        </span>
      )}
      {archived && canArchive && (
        <button
          type="button"
          onClick={restore}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          <ArchiveRestore className="size-3" />
          Restore
        </button>
      )}
      {canManage && !archived && (
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
            {canArchive && (
              <DropdownMenuItem
                onClick={() => {
                  // Cleared here rather than in the effect so the dialog never
                  // shows a stale count from a previous open.
                  setTaskCount(null);
                  setConfirmOpen(true);
                }}
                className="text-destructive"
              >
                <Trash2 className="size-3.5" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete section</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">“{name}”</span>
            {taskCount === null
              ? '?'
              : taskCount === 0
                ? '? It has no active tasks.'
                : ` and its ${taskCount} active task${taskCount === 1 ? '' : 's'}?`}{' '}
            Everything is archived together, so you can bring it all back with
            Show archived.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmArchive}
              disabled={pending}
            >
              {pending ? 'Deleting…' : 'Delete section'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
