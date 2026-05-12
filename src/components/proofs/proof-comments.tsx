"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { createClient } from "@/lib/supabase/client";
import {
  addProofComment,
  deleteProofComment,
  listMentionableUsers,
  listProofComments,
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

  // Stable client + once-per-open flag so collapsing/re-opening doesn't
  // cause cascading setState-in-effect lint complaints.
  const fetchedRef = useRef(false);
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

  // Initial fetch -----------------------------------------------------------
  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    listProofComments(proofId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        toast.error(res.error);
        setComments([]);
        return;
      }
      setComments(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, proofId]);

  // Realtime subscription ---------------------------------------------------
  // Subscribe whenever the section is open so other users' comments arrive
  // immediately. We refetch on every change rather than try to reconstruct
  // the row locally (the realtime payload doesn't include the joined
  // profile data, so a refetch keeps author names accurate).
  useEffect(() => {
    if (!open) return;
    const sb = createClient();
    const channel = sb
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
          listProofComments(proofId).then((res) => {
            if (res.ok) setComments(res.data);
          });
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [open, proofId]);

  // Lazy-load the mention list the first time the user shows interest in
  // commenting (i.e. when the section is open).
  useEffect(() => {
    if (!open || mentionablesLoadedRef.current) return;
    mentionablesLoadedRef.current = true;
    listMentionableUsers(proofId).then((res) => {
      if (res.ok) setMentionables(res.data);
    });
  }, [open, proofId]);

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

  const count = comments?.length ?? null;

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
                const canDelete = isAdmin || c.author_user_id === currentUserId;
                const isDeleting = deletePending && deletingId === c.id;
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
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground/90">
                        {renderBodyWithMentions(c.body)}
                      </p>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        disabled={isDeleting}
                        aria-label="Delete comment"
                        className={cn(
                          "shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive",
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
                className="flex w-full min-h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
 * Highlight `@Full Name` tokens in the rendered comment body. We don't try
 * to be too clever — any `@<word with optional spaces>` that matches our
 * convention gets the chip styling.
 */
function renderBodyWithMentions(body: string) {
  // Split on @Mention tokens. We accept letters, numbers, spaces, '.' and '-'
  // up to ~30 chars so "@Mary Ann O'Connor" works without being greedy.
  const parts = body.split(/(@[A-Za-z][A-Za-z0-9 .'\-]{0,30}?)(?=[\s,.!?:;)]|$)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("@") && part.length > 1) {
      return (
        <span
          key={idx}
          className="rounded bg-primary/10 px-1 py-px font-medium text-primary"
        >
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}
