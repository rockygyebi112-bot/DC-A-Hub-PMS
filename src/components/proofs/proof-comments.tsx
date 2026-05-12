"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import {
  addProofComment,
  deleteProofComment,
  listProofComments,
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

/**
 * Lightweight comments thread on a single proof. Lazy-loads the list when
 * the user expands the section so a long activity page with many proofs
 * doesn't trigger N+1 round-trips on first render. Anyone with project
 * read access can post — that includes client viewers, which is the whole
 * point: clients need a way to flag concerns on a specific document.
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
  // Tracks whether the initial fetch has been kicked off so a re-render
  // (e.g. from collapsing then re-expanding the section) doesn't refire it.
  // Using a ref means we never call setState inside the effect body just to
  // mark "loading", which keeps React's strict-mode + lint rules happy.
  const fetchedRef = useRef(false);
  const loading = open && comments === null;

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

  function submit() {
    const body = draft.trim();
    if (!body) return;
    startPosting(async () => {
      const res = await addProofComment(proofId, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setComments((prev) => (prev ? [...prev, res.data] : [res.data]));
      setDraft("");
      toast.success("Comment posted");
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
                        {c.body}
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
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment…"
              rows={2}
              maxLength={4000}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              className="text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Tip: press {navigatorMetaLabel()} + Enter to send
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

function navigatorMetaLabel() {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
}
