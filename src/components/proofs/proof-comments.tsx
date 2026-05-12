"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, MessageSquare, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { createClient } from "@/lib/supabase/client";
import {
  addProofComment,
  deleteProofComment,
  listMentionableUsers,
  listProofComments,
  updateProofComment,
  type MentionableUser,
  type ProofComment,
} from "@/lib/proofs/comments";
import { cn } from "@/lib/utils";

function formatRelative(iso: string) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Math.max(0, now - then);
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleString();
}

function metaKeyLabel() {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
}

// --- Mention group shortcuts ------------------------------------------------
// "@everyone" tags every mentionable (project members + all admins).
// "@team" narrows to staff + admins only, which is the typical "ping the
// internal team without spamming the client" use case.
type GroupKey = "everyone" | "team";
const GROUPS: {
  key: GroupKey;
  token: string;
  label: string;
  sublabel: string;
  filter: (u: MentionableUser) => boolean;
}[] = [
  {
    key: "everyone",
    token: "@everyone",
    label: "everyone",
    sublabel: "Notify all project members",
    filter: () => true,
  },
  {
    key: "team",
    token: "@team",
    label: "team",
    sublabel: "Notify staff & admins only",
    filter: (u) => u.role === "admin" || u.role === "staff",
  },
];

type PickerItem =
  | { kind: "user"; user: MentionableUser }
  | { kind: "group"; group: (typeof GROUPS)[number] };

/**
 * Lightweight comments thread on a single proof.
 *
 * - Lazy-loads the comment list when the user expands the section.
 * - Subscribes to Supabase Realtime on `proof_comments` so new comments
 *   from other users stream in without a refresh.
 * - Provides an @mention picker. Typing `@` opens a dropdown with project
 *   teammates + admins; selecting one inserts `@Full Name` into the
 *   textarea and tags them. Each tagged user gets a per-user notification.
 */
export function ProofComments({
  proofId,
  currentUserId,
  isAdmin = false,
  defaultOpen = false,
}: {
  proofId: string;
  currentUserId: string;
  isAdmin?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [comments, setComments] = useState<ProofComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, startPosting] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletePending, startDelete] = useTransition();
  // Edit-mode state — one comment at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editPending, startEdit] = useTransition();

  // Per-user / per-proof last-read marker. Stored in localStorage so the
  // "unread comments" badge persists across refreshes without adding a
  // backend table. Other devices won't sync — acceptable trade-off for
  // what is essentially a UI-only affordance.
  const readStorageKey = `dcahub.proof-comments.lastRead:${currentUserId}:${proofId}`;
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const loading = open && comments === null;

  // Mention infrastructure ---------------------------------------------------
  const [mentionables, setMentionables] = useState<MentionableUser[]>([]);
  const mentionablesLoadedRef = useRef(false);
  // Tracks who's been tagged in the current draft. Map key = user id, value
  // = display name we inserted. We re-derive on each submit by scanning the
  // body so deletions in the textarea silently un-tag the user.
  const [taggedUsers, setTaggedUsers] = useState<MentionableUser[]>([]);
  // Group shortcuts: "everyone" = all mentionables, "team" = staff+admins.
  // Stored separately from taggedUsers so the Will-notify preview can
  // show the group name instead of listing every member.
  const [taggedGroups, setTaggedGroups] = useState<Set<GroupKey>>(
    () => new Set<GroupKey>(),
  );
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState<number | null>(null);
  const [mentionHighlight, setMentionHighlight] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load the stored last-read marker on mount. Reading from localStorage
  // has to happen in an effect to avoid SSR hydration mismatches.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(readStorageKey);
      // Sync external (localStorage) state into React. The one-time
      // write here is the standard pattern for client-only values that
      // can't be read during SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastReadAt(stored);
    } catch {
      // Private mode / storage quota — fall back to treating everything
      // as read so we don't show a stale badge on every load.
      setLastReadAt(new Date().toISOString());
    }
  }, [readStorageKey]);

  // Initial fetch + realtime subscription — always on, regardless of
  // whether the thread is expanded. We need the list available at all
  // times so we can (1) show the unread badge on the collapsed header
  // and (2) stream incoming comments live to every viewer without
  // requiring them to click "Show" first.
  useEffect(() => {
    let cancelled = false;
    listProofComments(proofId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setComments([]);
        return;
      }
      setComments(res.data);
    });

    const sb = createClient();
    // Supabase Realtime enforces RLS using the JWT bound to the
    // WebSocket. With the SSR browser client the token is normally
    // applied via the auth state listener, but on first load (and
    // especially on Vercel where the session is restored from cookies)
    // .subscribe() can fire before the listener has propagated the
    // token. Without a JWT the channel is treated as anonymous, RLS
    // blocks proof_comments selects, and inserts silently never reach
    // the client. We explicitly fetch the session and pass the access
    // token to realtime before subscribing to close that race.
    let channel: ReturnType<typeof sb.channel> | null = null;
    (async () => {
      try {
        const { data } = await sb.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          await sb.realtime.setAuth(token);
        }
      } catch {
        // best-effort; subscription will still be attempted below
      }
      if (cancelled) return;
      channel = sb
        .channel(`proof-comments-${proofId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "proof_comments",
            filter: `proof_id=eq.${proofId}`,
          },
          () => {
            // Refetch rather than reconstruct — the realtime payload
            // doesn't include joined profile data, and a small fetch
            // keeps author names accurate.
            listProofComments(proofId).then((res) => {
              if (!cancelled && res.ok) setComments(res.data);
            });
          },
        )
        .subscribe((status) => {
          // Surface channel-level failures during development so we can
          // tell a "no events" symptom apart from a quiet successful
          // subscription. Production logs can be pruned later.
          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            // eslint-disable-next-line no-console
            console.warn(
              `[proof-comments] realtime channel ${status} for proof ${proofId}`,
            );
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) sb.removeChannel(channel);
    };
  }, [proofId]);

  // When the thread is expanded, mark everything currently visible as
  // read so the unread badge clears. New comments that arrive after this
  // point will bump past the stored marker and re-badge if the user
  // collapses and later returns.
  useEffect(() => {
    if (!open) return;
    const now = new Date().toISOString();
    try {
      window.localStorage.setItem(readStorageKey, now);
    } catch {
      // ignore
    }
    // Syncing the externally-persisted read marker back into React state
    // so the unread badge recomputes. This is the intended pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastReadAt(now);
  }, [open, readStorageKey, comments]);

  // Load the mention list eagerly. We need it regardless of whether the
  // composer is open so that already-posted comments can highlight
  // "@Full Name" tokens correctly (otherwise we can't tell where a name
  // ends and the surrounding prose begins).
  useEffect(() => {
    if (mentionablesLoadedRef.current) return;
    mentionablesLoadedRef.current = true;
    listMentionableUsers(proofId).then((res) => {
      if (res.ok) setMentionables(res.data);
    });
  }, [proofId]);

  // Tokens we'll highlight inside a comment body / draft. Real teammate
  // names take precedence over the @everyone / @team group shortcuts so
  // we sort longest-first and try those first when scanning. Recomputed
  // whenever the mention list changes.
  const mentionTokens = useMemo(() => {
    const names = mentionables.map((u) => u.full_name).filter(Boolean);
    const groups = GROUPS.map((g) => g.label); // "everyone", "team"
    return [...names, ...groups].sort((a, b) => b.length - a.length);
  }, [mentionables]);

  // Determine which tagged users still appear (by name) in the body. We
  // compute this on the fly so deletions in the textarea silently un-tag.
  // Groups still present in the draft expand to their member ids so the
  // server can dispatch one targeted notification per user.
  const effectiveMentions = useMemo(() => {
    const direct = taggedUsers.filter((u) => draft.includes(`@${u.full_name}`));
    const byId = new Map<string, MentionableUser>(
      direct.map((u) => [u.user_id, u]),
    );
    for (const g of GROUPS) {
      if (!taggedGroups.has(g.key)) continue;
      if (!draft.includes(g.token)) continue;
      for (const u of mentionables) {
        if (!g.filter(u)) continue;
        if (!byId.has(u.user_id)) byId.set(u.user_id, u);
      }
    }
    return Array.from(byId.values());
  }, [draft, taggedUsers, taggedGroups, mentionables]);

  const activeGroups = useMemo(
    () => GROUPS.filter((g) => taggedGroups.has(g.key) && draft.includes(g.token)),
    [draft, taggedGroups],
  );

  function handleDraftChange(value: string, caret: number) {
    setDraft(value);
    // Detect an active "@..." token at the caret. We walk back from the
    // caret until we hit whitespace, an @, or the start of the string.
    const upToCaret = value.slice(0, caret);
    const atIdx = upToCaret.lastIndexOf("@");
    if (atIdx === -1) {
      setMentionQuery(null);
      setMentionAnchor(null);
      return;
    }
    // The character before the @ must be whitespace or start-of-string,
    // otherwise we'd hijack things like email addresses.
    const charBefore = atIdx === 0 ? " " : upToCaret[atIdx - 1];
    if (!/\s/.test(charBefore) && atIdx !== 0) {
      setMentionQuery(null);
      setMentionAnchor(null);
      return;
    }
    const query = upToCaret.slice(atIdx + 1);
    if (query.includes("\n") || query.length > 30) {
      setMentionQuery(null);
      setMentionAnchor(null);
      return;
    }
    setMentionQuery(query);
    setMentionAnchor(atIdx);
    setMentionHighlight(0);
  }

  const filteredItems = useMemo<PickerItem[]>(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const groupItems: PickerItem[] = GROUPS.filter(
      (g) => !q || g.label.startsWith(q),
    ).map((g) => ({ kind: "group" as const, group: g }));
    const userItems: PickerItem[] = mentionables
      .filter((u) => {
        if (!q) return true;
        return (
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      })
      .map((u) => ({ kind: "user" as const, user: u }));
    return [...groupItems, ...userItems].slice(0, 6);
  }, [mentionQuery, mentionables]);

  function pickItem(item: PickerItem) {
    if (mentionAnchor === null) return;
    const before = draft.slice(0, mentionAnchor);
    // Replace the in-progress token (anchor..caret) with the full mention.
    // Anything after the caret is preserved as-is.
    const ta = textareaRef.current;
    const caret = ta ? ta.selectionStart ?? draft.length : draft.length;
    const after = draft.slice(caret);
    const insertion =
      item.kind === "user"
        ? `@${item.user.full_name} `
        : `${item.group.token} `;
    const next = `${before}${insertion}${after}`;
    setDraft(next);
    if (item.kind === "user") {
      const user = item.user;
      setTaggedUsers((prev) =>
        prev.some((u) => u.user_id === user.user_id) ? prev : [...prev, user],
      );
    } else {
      const key = item.group.key;
      setTaggedGroups((prev) => {
        if (prev.has(key)) return prev;
        const nextSet = new Set(prev);
        nextSet.add(key);
        return nextSet;
      });
    }
    setMentionQuery(null);
    setMentionAnchor(null);
    // Restore focus + caret to right after the insertion.
    queueMicrotask(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const pos = before.length + insertion.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function submit() {
    const body = draft.trim();
    if (!body) return;
    const mentionedIds = effectiveMentions.map((u) => u.user_id);
    startPosting(async () => {
      const res = await addProofComment(proofId, body, mentionedIds);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Optimistic local update — realtime will overwrite it on the next
      // refetch, but we don't want the user to wait.
      setComments((prev) => (prev ? [...prev, res.data] : [res.data]));
      setDraft("");
      setTaggedUsers([]);
      setTaggedGroups(new Set());
      const tagged = mentionedIds.length;
      toast.success(
        tagged > 0
          ? `Comment posted · ${tagged} ${tagged === 1 ? "person" : "people"} tagged`
          : "Comment posted",
      );
    });
  }

  function remove(id: string) {
    setDeletingId(id);
    startDelete(async () => {
      const res = await deleteProofComment(id);
      setDeletingId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setComments((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
    });
  }

  function beginEdit(c: ProofComment) {
    setEditingId(c.id);
    setEditDraft(c.body);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }
  function saveEdit(id: string) {
    const body = editDraft.trim();
    if (!body) return;
    startEdit(async () => {
      const res = await updateProofComment(id, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setComments((prev) =>
        prev ? prev.map((c) => (c.id === id ? res.data : c)) : prev,
      );
      setEditingId(null);
      setEditDraft("");
      toast.success("Comment updated");
    });
  }

  const count = comments?.length ?? null;
  // Unread = comments authored by someone else whose created_at is newer
  // than the stored last-read marker. We never count your own messages.
  // When lastReadAt is null (first ever visit) every foreign comment is
  // considered unread.
  const unreadCount = useMemo(() => {
    if (!comments || open) return 0;
    return comments.filter(
      (c) =>
        c.author_user_id !== currentUserId &&
        (!lastReadAt || c.created_at > lastReadAt),
    ).length;
  }, [comments, currentUserId, lastReadAt, open]);

  return (
    <div className="mt-2 rounded-lg border bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare className="size-3.5" />
          Comments
          {count != null && (
            <span className="rounded-full bg-muted px-1.5 py-px font-mono text-[10px] tabular-nums">
              {count}
            </span>
          )}
          {unreadCount > 0 && (
            <span
              className="rounded-full bg-primary px-1.5 py-px font-mono text-[10px] font-semibold tabular-nums text-primary-foreground"
              aria-label={`${unreadCount} unread`}
            >
              {unreadCount} new
            </span>
          )}
        </span>
        <span className="text-[10px] uppercase tracking-wider">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t px-3 py-3">
          {loading && comments === null ? (
            <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
              <Loader2 className="mr-2 size-3.5 animate-spin" />
              Loading comments…
            </div>
          ) : comments && comments.length > 0 ? (
            <ul className="space-y-3">
              {comments.map((c) => {
                const isAuthor = c.author_user_id === currentUserId;
                const canDelete = isAdmin || isAuthor;
                const canEdit = isAuthor;
                const isDeleting = deletePending && deletingId === c.id;
                const isEditing = editingId === c.id;
                const isSaving = editPending && isEditing;
                // `updated_at` is bumped by a trigger on every update; if
                // it's materially newer than `created_at` we consider the
                // comment edited. 2s threshold avoids false positives from
                // insert-time write timing.
                const wasEdited =
                  new Date(c.updated_at).getTime() -
                    new Date(c.created_at).getTime() >
                  2000;
                return (
                  <li key={c.id} className="flex items-start gap-2.5">
                    <UserAvatar
                      email={c.author_user_id}
                      name={c.author_name ?? "Member"}
                      avatarUrl={c.author_avatar_url}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-xs font-semibold text-foreground">
                          {c.author_name ?? "Member"}
                        </span>
                        <span
                          className="text-[10px] text-muted-foreground"
                          title={new Date(c.created_at).toLocaleString()}
                        >
                          {formatRelative(c.created_at)}
                        </span>
                        {wasEdited && (
                          <span
                            className="text-[10px] italic text-muted-foreground"
                            title={`Edited ${new Date(c.updated_at).toLocaleString()}`}
                          >
                            (edited)
                          </span>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="mt-1 space-y-1.5">
                          <div className="relative">
                            <MentionHighlightOverlay
                              value={editDraft}
                              knownTokens={mentionTokens}
                            />
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelEdit();
                                }
                                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                  e.preventDefault();
                                  saveEdit(c.id);
                                }
                              }}
                              rows={2}
                              maxLength={4000}
                              autoFocus
                              className="relative flex w-full min-h-9 rounded-md border bg-transparent px-3 py-1 text-sm leading-5 shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="xs"
                              onClick={() => saveEdit(c.id)}
                              disabled={
                                isSaving ||
                                editDraft.trim().length === 0 ||
                                editDraft.trim() === c.body.trim()
                              }
                            >
                              {isSaving ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : null}
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              onClick={cancelEdit}
                              disabled={isSaving}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground/90">
                          {renderBodyWithMentions(c.body, mentionTokens)}
                        </p>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => beginEdit(c)}
                            aria-label="Edit comment"
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => remove(c.id)}
                            disabled={isDeleting}
                            aria-label="Delete comment"
                            className={cn(
                              "rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive",
                              isDeleting && "opacity-50",
                            )}
                          >
                            {isDeleting ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-1 text-xs text-muted-foreground">
              No comments yet. Be the first to add one.
            </p>
          )}

          <div className="space-y-2">
            <div className="relative">
              <MentionHighlightOverlay
                value={draft}
                knownTokens={mentionTokens}
              />
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) =>
                  handleDraftChange(e.target.value, e.target.selectionStart ?? 0)
                }
                onKeyDown={(e) => {
                  if (mentionQuery !== null && filteredItems.length > 0) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setMentionHighlight(
                        (h) => (h + 1) % filteredItems.length,
                      );
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setMentionHighlight(
                        (h) =>
                          (h - 1 + filteredItems.length) %
                          filteredItems.length,
                      );
                      return;
                    }
                    if (e.key === "Enter" || e.key === "Tab") {
                      e.preventDefault();
                      pickItem(filteredItems[mentionHighlight]);
                      return;
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setMentionQuery(null);
                      setMentionAnchor(null);
                      return;
                    }
                  }
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Add a comment… type @ to tag a teammate"
                rows={2}
                maxLength={4000}
                className="relative flex w-full min-h-9 rounded-md border bg-transparent px-3 py-1 text-sm leading-5 shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />

              {mentionQuery !== null && filteredItems.length > 0 && (
                <div className="absolute bottom-full left-0 z-10 mb-1 w-72 max-w-full overflow-hidden rounded-md border bg-popover shadow-md">
                  <ul className="max-h-60 overflow-y-auto py-1 text-sm">
                    {filteredItems.map((item, idx) => {
                      const active = idx === mentionHighlight;
                      const key =
                        item.kind === "user"
                          ? `u:${item.user.user_id}`
                          : `g:${item.group.key}`;
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              // mousedown so the textarea doesn't lose focus
                              // before our click runs.
                              e.preventDefault();
                              pickItem(item);
                            }}
                            onMouseEnter={() => setMentionHighlight(idx)}
                            className={cn(
                              "flex w-full items-center gap-2 px-2 py-1.5 text-left",
                              active ? "bg-accent text-accent-foreground" : "",
                            )}
                          >
                            {item.kind === "user" ? (
                              <>
                                <UserAvatar
                                  email={item.user.email}
                                  name={item.user.full_name}
                                  avatarUrl={item.user.avatar_url}
                                  size="sm"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-semibold">
                                    {item.user.full_name}
                                    {item.user.is_manager && (
                                      <span className="ml-1.5 rounded bg-primary/10 px-1 py-px text-[9px] font-medium uppercase tracking-wider text-primary">
                                        PM
                                      </span>
                                    )}
                                  </span>
                                  <span className="block truncate text-[10px] text-muted-foreground">
                                    {item.user.role === "client"
                                      ? "Client"
                                      : item.user.email}
                                  </span>
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] font-semibold uppercase text-primary">
                                  {item.group.key === "everyone" ? "ALL" : "TM"}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-semibold">
                                    @{item.group.label}
                                    <span className="ml-1.5 rounded bg-muted px-1 py-px text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                                      Group
                                    </span>
                                  </span>
                                  <span className="block truncate text-[10px] text-muted-foreground">
                                    {item.group.sublabel}
                                  </span>
                                </span>
                              </>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {effectiveMentions.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Will notify{" "}
                <span className="font-mono">({effectiveMentions.length})</span>:{" "}
                {activeGroups.map((g, i) => (
                  <span key={`g:${g.key}`}>
                    {i > 0 ? ", " : ""}
                    <span className="font-medium text-foreground">
                      @{g.label}
                    </span>
                  </span>
                ))}
                {activeGroups.length > 0 && taggedUsers.filter((u) => draft.includes(`@${u.full_name}`)).length > 0 && ", "}
                {taggedUsers
                  .filter((u) => draft.includes(`@${u.full_name}`))
                  .map((u, i) => (
                    <span key={u.user_id}>
                      {i > 0 ? ", " : ""}
                      <span className="font-medium text-foreground">
                        {u.full_name}
                      </span>
                    </span>
                  ))}
              </p>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Tip: type <kbd className="rounded bg-muted px-1">@</kbd> to tag · press {metaKeyLabel()} + Enter to send
              </span>
              <Button
                type="button"
                size="sm"
                onClick={submit}
                disabled={posting || draft.trim().length === 0}
              >
                {posting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Post
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Walk the body and split it into plain text + mention segments. A
 * mention is `@` immediately followed by one of the known tokens
 * (teammate full names + group labels like "everyone" / "team"). Longest
 * tokens are checked first so "@Jane Doe" wins over "@Jane".
 */
function segmentMentions(body: string, knownTokens: string[]) {
  type Seg = { kind: "text" | "mention"; value: string };
  const segs: Seg[] = [];
  const push = (kind: Seg["kind"], value: string) => {
    if (!value) return;
    const last = segs[segs.length - 1];
    if (last && last.kind === kind && kind === "text") {
      last.value += value;
    } else {
      segs.push({ kind, value });
    }
  };
  let i = 0;
  while (i < body.length) {
    if (body[i] === "@") {
      let matched: string | null = null;
      for (const tok of knownTokens) {
        if (!tok) continue;
        if (
          body.slice(i + 1, i + 1 + tok.length).toLowerCase() ===
          tok.toLowerCase()
        ) {
          // Boundary: the character after the token must be whitespace,
          // punctuation, or end-of-string — otherwise we'd match "@team"
          // inside "@teammate".
          const next = body[i + 1 + tok.length];
          if (!next || /[\s,.!?:;)]/.test(next)) {
            matched = body.slice(i, i + 1 + tok.length);
            break;
          }
        }
      }
      if (matched) {
        push("mention", matched);
        i += matched.length;
        continue;
      }
    }
    push("text", body[i]);
    i++;
  }
  return segs;
}

/**
 * Render a comment body with `@Mention` chips highlighted.
 */
function renderBodyWithMentions(body: string, knownTokens: string[]) {
  return segmentMentions(body, knownTokens).map((seg, idx) =>
    seg.kind === "mention" ? (
      <span
        key={idx}
        className="rounded bg-primary/10 px-1 py-px font-medium text-primary"
      >
        {seg.value}
      </span>
    ) : (
      <span key={idx}>{seg.value}</span>
    ),
  );
}

/**
 * Mirror overlay rendered behind the comment textarea. The overlay paints
 * mention tokens with a coloured background while leaving every glyph
 * itself transparent — the real text comes from the textarea on top.
 * Padding / font / line-height MUST match the textarea exactly so the
 * highlight aligns character-for-character.
 */
function MentionHighlightOverlay({
  value,
  knownTokens,
}: {
  value: string;
  knownTokens: string[];
}) {
  const segs = segmentMentions(value, knownTokens);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent px-3 py-1 text-sm leading-5"
    >
      {segs.map((seg, idx) =>
        seg.kind === "mention" ? (
          <span
            key={idx}
            className="rounded bg-primary/15 text-transparent"
          >
            {seg.value}
          </span>
        ) : (
          <span key={idx} className="text-transparent">
            {seg.value}
          </span>
        ),
      )}
      {/* Trailing newline guard so the overlay grows the same way as the
          textarea when the user hits Enter at the end of the input. */}
      {value.endsWith("\n") ? "\u200b" : ""}
    </div>
  );
}
