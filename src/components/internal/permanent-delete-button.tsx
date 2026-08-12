'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  deleteAreaPermanently,
  deleteTaskPermanently,
  describeTaskDeletion,
} from '@/lib/internal/actions';
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
 * "Delete permanently" for archived sections and tasks. Admin-only and
 * irreversible, so it is rendered only where the caller has already
 * established both conditions — this component does not gate on role itself.
 *
 * The task variant asks the server what will be destroyed when the dialog
 * opens, so the confirmation names real numbers rather than a vague warning.
 */
export function PermanentDeleteButton({
  target,
  id,
  name,
  parentId,
  variant = 'icon',
  onDeleted,
}: {
  target: 'task' | 'area';
  id: string;
  name: string;
  /** Parent task id, so a subtask deletion revalidates the page it sits on. */
  parentId?: string;
  variant?: 'icon' | 'text';
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<{
    subtasks: number;
    documents: number;
    comments: number;
  } | null>(null);

  useEffect(() => {
    if (!open || target !== 'task') return;
    let cancelled = false;
    describeTaskDeletion(id).then((r) => {
      if (!cancelled && r.ok && r.data) setSummary(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, id, target]);

  function confirm() {
    start(async () => {
      const r =
        target === 'task'
          ? await deleteTaskPermanently(id, parentId)
          : await deleteAreaPermanently(id);
      if (r.ok) {
        toast.success(target === 'task' ? 'Task deleted' : 'Section deleted');
        setOpen(false);
        onDeleted?.();
        router.refresh();
      } else {
        toast.error(r.error ?? 'Could not delete');
      }
    });
  }

  const extras = summary
    ? [
        summary.subtasks && `${summary.subtasks} subtask${summary.subtasks === 1 ? '' : 's'}`,
        summary.comments && `${summary.comments} comment${summary.comments === 1 ? '' : 's'}`,
        summary.documents &&
          `${summary.documents} document${summary.documents === 1 ? '' : 's'}`,
      ].filter(Boolean)
    : [];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSummary(null);
          setOpen(true);
        }}
        disabled={pending}
        aria-label={`Delete ${name} permanently`}
        title="Delete permanently"
        className={cn(
          'shrink-0 text-muted-foreground transition hover:text-destructive disabled:opacity-50',
          variant === 'icon'
            ? 'grid size-6 place-items-center rounded hover:bg-muted'
            : 'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:border-destructive',
        )}
      >
        <Trash2 className={variant === 'icon' ? 'size-3.5' : 'size-4'} />
        {variant === 'text' && 'Delete permanently'}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete permanently</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete{' '}
            <span className="font-medium text-foreground">“{name}”</span>
            {target === 'area'
              ? ' and every task inside it'
              : extras.length > 0
                ? `, along with its ${extras.join(', ')}`
                : ''}
            ? Uploaded files are removed too. This cannot be undone.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirm}
              disabled={pending}
            >
              {pending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
