'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/admin/ui/user-avatar';
import { formatTimestamp } from '@/components/workspace/activity-detail-view/format';
import type { InternalComment } from '@/lib/internal/queries';
import { findMentionQuery, toMentionMarkup } from '@/lib/internal/mentions';
import { cn } from '@/lib/utils';
import { CommentBody } from './comment-body';

export type ComposerUser = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

type ActionResultLike = { ok: boolean; error?: string };

type Staff = { user_id: string; full_name: string };

/** Matches the `length(body) <= 4000` CHECK on both comment tables. */
const MAX_BODY = 4000;

/** How many names the @ picker shows at once. */
const MAX_SUGGESTIONS = 6;

/**
 * Inline comment composer. Posts a single `body` field; the bound server
 * action persists it and revalidates the page so the thread re-renders.
 *
 * Typing `@` opens a picker of staff colleagues. The textarea shows the plain
 * `@Full Name` — nobody should have to look at a UUID while writing a
 * sentence — and the names picked from the list are converted to id-anchored
 * `@[Full Name](user-id)` markup on submit, so the stored mention survives a
 * rename and stays unambiguous between people sharing a first name.
 *
 * A name merely typed by hand is never converted: it has no id, so it renders
 * as written and notifies nobody.
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
  const [value, setValue] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [query, setQuery] = useState<{ query: string; start: number } | null>(
    null,
  );
  const [highlight, setHighlight] = useState(0);
  // Names this author actually picked from the list, so submit knows which
  // plain "@Name" strings have an id behind them. A ref, not state: changing
  // it must not re-render, and it has to survive a failed post so a retry
  // still anchors the same mentions.
  const picked = useRef(new Map<string, string>());

  // Same source and same failure mode as AssigneePicker: if this fails the
  // picker simply never offers anyone, and plain comments still post.
  useEffect(() => {
    fetch('/api/internal/staff')
      .then((r) => r.json())
      .then(setStaff)
      .catch(() => setStaff([]));
  }, []);

  const matches = useMemo(() => {
    if (!query) return [];
    const needle = query.query.trim().toLowerCase();
    return staff
      .filter((s) => s.full_name.toLowerCase().includes(needle))
      .slice(0, MAX_SUGGESTIONS);
  }, [query, staff]);

  const pickerOpen = query !== null && matches.length > 0;

  /** Recompute the active @query from the live caret position. */
  function syncQuery(el: HTMLTextAreaElement) {
    setQuery(findMentionQuery(el.value, el.selectionStart ?? 0));
    setHighlight(0);
  }

  function insertMention(pick: Staff) {
    const el = inputRef.current;
    if (!el || !query) return;
    const caret = el.selectionStart ?? value.length;
    const label = `@${pick.full_name} `;
    const next = value.slice(0, query.start) + label + value.slice(caret);
    picked.current.set(pick.full_name, pick.user_id);
    setValue(next);
    setQuery(null);
    // Restore focus and drop the caret after the inserted mention, once React
    // has committed the new value.
    requestAnimationFrame(() => {
      const at = query.start + label.length;
      el.focus();
      el.setSelectionRange(at, at);
    });
  }

  function submit(formData: FormData) {
    const typed = String(formData.get('body') ?? '').trim();
    if (!typed) {
      toast.error('Write something first.');
      return;
    }
    const body = toMentionMarkup(typed, picked.current);
    if (body.length > MAX_BODY) {
      // Mention markup counts toward the DB limit, so the visible text can be
      // comfortably under 4000 while the stored body is not.
      toast.error(`That comment is too long by ${body.length - MAX_BODY} characters.`);
      return;
    }
    formData.set('body', body);
    setValue('');
    setQuery(null);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    inputRef.current?.focus();
    start(async () => {
      const res = await action(formData);
      if (!res.ok) {
        toast.error(res.error ?? 'Could not post comment');
        // Restore what the author typed, not the markup they never saw.
        setValue(typed);
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="relative rounded-2xl border bg-background p-2.5 pl-3 transition-shadow focus-within:shadow-sm focus-within:ring-2 focus-within:ring-primary/15"
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
          value={value}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={pickerOpen}
          aria-controls="mention-picker"
          aria-autocomplete="list"
          className="min-h-7 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          onChange={(e) => {
            setValue(e.currentTarget.value);
            syncQuery(e.currentTarget);
          }}
          onClick={(e) => syncQuery(e.currentTarget)}
          onBlur={() => setQuery(null)}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (pickerOpen) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlight((h) => (h + 1) % matches.length);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlight((h) => (h - 1 + matches.length) % matches.length);
                return;
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                // While the list is open Enter picks a name; it must not also
                // post the half-written comment.
                e.preventDefault();
                insertMention(matches[highlight]);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setQuery(null);
                return;
              }
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          onKeyUp={(e) => {
            // Arrow/Home/End move the caret without changing the value, which
            // can carry it out of (or into) a mention query.
            if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') {
              if (!pickerOpen) syncQuery(e.currentTarget);
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

      {pickerOpen && (
        <ul
          id="mention-picker"
          role="listbox"
          aria-label="Mention a colleague"
          className="absolute left-12 right-3 top-full z-20 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md"
        >
          {matches.map((s, i) => (
            <li key={s.user_id}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                // The textarea's blur fires before click; mousedown wins.
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(s);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                  i === highlight ? 'bg-muted text-foreground' : 'text-foreground/80',
                )}
              >
                {s.full_name}
              </button>
            </li>
          ))}
        </ul>
      )}
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
          currentUserId={currentUserId}
          canDelete={isAdmin || c.author_user_id === currentUserId}
          deleteAction={deleteAction}
        />
      ))}
    </ul>
  );
}

function CommentRow({
  comment,
  currentUserId,
  canDelete,
  deleteAction,
}: {
  comment: InternalComment;
  currentUserId: string;
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
        <CommentBody body={comment.body} currentUserId={currentUserId} />
      </div>
    </li>
  );
}
