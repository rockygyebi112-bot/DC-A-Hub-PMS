'use client';

import { useRef, useState, useTransition } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/admin/ui/user-avatar';
import { formatTimestamp } from '@/components/workspace/activity-detail-view/format';
import type { InternalComment } from '@/lib/internal/queries';

export type ComposerUser = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

type ActionResultLike = { ok: boolean; error?: string };

/**
 * Inline comment composer. Posts a single `body` field; the bound server
 * action persists it and revalidates the page so the thread re-renders.
 */
export function CommentComposer({
  action,
  user,
  placeholder = 'Write a comment…',
}: {
  action: (formData: FormData) => Promise<ActionResultLike>;
  user: ComposerUser;
  placeholder?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    const body = String(formData.get('body') ?? '').trim();
    if (!body) {
      toast.error('Write something first.');
      return;
    }
    // Eager reset; the captured FormData still carries the value.
    formRef.current?.reset();
    if (inputRef.current) inputRef.current.style.height = 'auto';
    inputRef.current?.focus();
    start(async () => {
      const res = await action(formData);
      if (!res.ok) {
        toast.error(res.error ?? 'Could not post comment');
        if (inputRef.current) inputRef.current.value = body;
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="rounded-2xl border bg-background p-2.5 pl-3 transition-shadow focus-within:shadow-sm focus-within:ring-2 focus-within:ring-primary/15"
    >
      <div className="flex items-start gap-3">
        <UserAvatar
          size="sm"
          email={user.email}
          name={user.name}
          avatarUrl={user.avatarUrl}
        />
        <textarea
          ref={inputRef}
          name="body"
          rows={1}
          placeholder={placeholder}
          className="min-h-7 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="size-3.5" />
          {pending ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  );
}

/**
 * Renders a chronological comment thread. A delete button shows only on
 * comments the current user may remove (their own, or any when admin).
 */
export function CommentList({
  comments,
  currentUserId,
  isAdmin,
  deleteAction,
  emptyLabel = 'No comments yet.',
}: {
  comments: InternalComment[];
  currentUserId: string;
  isAdmin: boolean;
  deleteAction: (commentId: string) => Promise<ActionResultLike>;
  emptyLabel?: string;
}) {
  if (comments.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {comments.map((c) => (
        <CommentRow
          key={c.id}
          comment={c}
          canDelete={isAdmin || c.author_user_id === currentUserId}
          deleteAction={deleteAction}
        />
      ))}
    </ul>
  );
}

function CommentRow({
  comment,
  canDelete,
  deleteAction,
}: {
  comment: InternalComment;
  canDelete: boolean;
  deleteAction: (commentId: string) => Promise<ActionResultLike>;
}) {
  const [pending, start] = useTransition();
  const [removed, setRemoved] = useState(false);
  if (removed) return null;

  function remove() {
    start(async () => {
      const res = await deleteAction(comment.id);
      if (res.ok) {
        setRemoved(true);
      } else {
        toast.error(res.error ?? 'Could not delete comment');
      }
    });
  }

  return (
    <li className="group flex gap-3">
      <UserAvatar
        email={comment.author_user_id}
        name={comment.authorName ?? 'Unknown'}
        avatarUrl={comment.authorAvatarUrl}
        size="md"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-foreground">
            {comment.authorName ?? 'Unknown'}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(comment.created_at)}
          </span>
          {canDelete && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              aria-label="Delete comment"
              className="ml-auto grid size-6 place-items-center rounded text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {comment.body}
        </p>
      </div>
    </li>
  );
}
