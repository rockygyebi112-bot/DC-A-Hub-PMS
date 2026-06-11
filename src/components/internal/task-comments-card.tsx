'use client';

import { MessageSquare } from 'lucide-react';
import {
  postInternalTaskComment,
  deleteInternalTaskComment,
} from '@/lib/internal/proofs';
import type { InternalComment } from '@/lib/internal/queries';
import { CommentComposer, CommentList, type ComposerUser } from './comments';

/**
 * Task-level discussion feed — the "comment on the task" half of the Asana
 * pattern. Mirrors the project Updates card visually.
 */
export function TaskCommentsCard({
  taskId,
  comments,
  user,
  currentUserId,
  isAdmin,
}: {
  taskId: string;
  comments: InternalComment[];
  user: ComposerUser;
  currentUserId: string;
  isAdmin: boolean;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight">
          <MessageSquare className="size-4" />
          Activity
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </span>
      </header>
      <div className="space-y-5 px-5 py-4">
        <CommentList
          comments={comments}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          deleteAction={(commentId) =>
            deleteInternalTaskComment(taskId, commentId)
          }
          emptyLabel="No comments yet. Start the discussion below."
        />
        <CommentComposer
          user={user}
          placeholder="Write a comment…"
          action={(fd) => postInternalTaskComment(taskId, fd)}
        />
      </div>
    </section>
  );
}
