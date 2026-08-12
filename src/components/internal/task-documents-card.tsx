'use client';

import { useRef, useState, useTransition } from 'react';
import {
  ExternalLink,
  Loader2,
  MessageSquare,
  Paperclip,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fileVisuals } from '@/components/workspace/activity-detail-view/file-visuals';
import {
  formatBytes,
  formatShortDate,
} from '@/components/workspace/activity-detail-view/format';
import type { WorkspaceProof } from '@/lib/workspace/queries';
import { cn } from '@/lib/utils';
import {
  uploadInternalTaskProofs,
  deleteInternalTaskProof,
  requestInternalProofAccess,
  addInternalProofComment,
  deleteInternalProofComment,
} from '@/lib/internal/proofs';
import type { InternalProof, InternalComment } from '@/lib/internal/queries';
import { MAX_PROOF_BYTES } from '@/lib/uploads';
import { CommentComposer, CommentList, type ComposerUser } from './comments';

/** Adapt an internal proof to the shape `fileVisuals` reads (icon/colour). */
function visuals(proof: InternalProof) {
  return fileVisuals({
    kind: 'file',
    file_name: proof.file_name,
    mime_type: proof.mime_type,
  } as WorkspaceProof);
}

export function TaskDocumentsCard({
  taskId,
  proofs,
  commentsByProof,
  user,
  currentUserId,
  isAdmin,
}: {
  taskId: string;
  proofs: InternalProof[];
  commentsByProof: Record<string, InternalComment[]>;
  user: ComposerUser;
  currentUserId: string;
  isAdmin: boolean;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          <Paperclip className="size-4" />
          Documents
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {proofs.length} {proofs.length === 1 ? 'item' : 'items'}
        </span>
      </header>
      <div className="space-y-4 px-5 py-4">
        {proofs.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/30 p-5 text-center text-xs text-muted-foreground">
            No documents
          </p>
        ) : (
          <ul className="space-y-2">
            {proofs.map((proof) => (
              <li key={proof.id}>
                <DocumentRow
                  taskId={taskId}
                  proof={proof}
                  comments={commentsByProof[proof.id] ?? []}
                  user={user}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                />
              </li>
            ))}
          </ul>
        )}
        <Uploader taskId={taskId} />
      </div>
    </section>
  );
}

function DocumentRow({
  taskId,
  proof,
  comments,
  user,
  currentUserId,
  isAdmin,
}: {
  taskId: string;
  proof: InternalProof;
  comments: InternalComment[];
  user: ComposerUser;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = visuals(proof);
  const commentCount = comments.length;
  const canDelete = isAdmin || proof.uploaded_by === currentUserId;

  return (
    <div className="group/file relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border bg-background p-2.5 text-left transition-colors hover:bg-muted/40',
          // Room for the delete button so a long filename never runs under it.
          canDelete && 'pr-11',
        )}
      >
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg text-white',
            meta.bg,
          )}
        >
          {meta.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {proof.file_name}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            Uploaded {formatShortDate(proof.created_at)}
            {proof.uploaderName ? ` · ${proof.uploaderName}` : ''}
            {proof.caption ? ` · ${proof.caption}` : ''}
          </span>
        </span>
        <span className="ml-2 flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" />
              {commentCount}
            </span>
          )}
          {proof.size_bytes ? formatBytes(proof.size_bytes) : null}
        </span>
      </button>

      {/* Sibling of the row rather than inside it — a button cannot nest in a
          button. Always visible on touch, where there is no hover to reveal it. */}
      {canDelete && (
        <DeleteDocButton
          taskId={taskId}
          proof={proof}
          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-100 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover/file:opacity-100"
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-lg text-white',
                meta.bg,
              )}
            >
              {meta.icon}
            </span>
            <span className="min-w-0 flex-1 truncate">{proof.file_name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="min-w-0 truncate">
              {proof.size_bytes ? `${formatBytes(proof.size_bytes)} · ` : ''}
              Uploaded {formatShortDate(proof.created_at)}
              {proof.uploaderName ? ` by ${proof.uploaderName}` : ''}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <OpenButton proofId={proof.id} />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Comments
            </h3>
            <CommentList
              comments={comments}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              deleteAction={(commentId) =>
                deleteInternalProofComment(taskId, commentId)
              }
              emptyLabel="No comments on this document yet."
            />
            <CommentComposer
              user={user}
              placeholder="Comment on this document…"
              action={(fd) => addInternalProofComment(taskId, proof.id, fd)}
            />
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </div>
  );
}

function OpenButton({ proofId }: { proofId: string }) {
  const [pending, start] = useTransition();
  function open() {
    start(async () => {
      const res = await requestInternalProofAccess(proofId);
      if (!res.ok || !res.data?.url) {
        toast.error(res.ok ? 'Could not open document' : res.error);
        return;
      }
      const win = window.open(res.data.url, '_blank', 'noopener,noreferrer');
      if (!win) {
        toast.error('Your browser blocked the popup. Allow popups and retry.');
      }
    });
  }
  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <ExternalLink className="size-3.5" />
      )}
      Open
    </button>
  );
}

/**
 * Delete a document, behind a confirmation. Rendered only where the caller has
 * established the right to delete (uploader or admin); this does not gate on
 * role itself, matching `PermanentDeleteButton`.
 *
 * Deleting removes the storage object and cascades to the document's comment
 * thread, so it asks first — the old version deleted on a single click of an
 * unlabelled icon.
 */
function DeleteDocButton({
  taskId,
  proof,
  className,
}: {
  taskId: string;
  proof: InternalProof;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      const res = await deleteInternalTaskProof(taskId, proof.id);
      if (res.ok) {
        toast.success('Document deleted');
        setOpen(false);
      } else {
        toast.error(res.error ?? 'Could not delete document');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        aria-label={`Delete ${proof.file_name}`}
        title="Delete document"
        className={cn(
          'grid size-7 place-items-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50',
          className,
        )}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete{' '}
            <span className="font-medium text-foreground">
              &ldquo;{proof.file_name}&rdquo;
            </span>
            ? Any comments on it go too, and the file is removed from storage.
            This cannot be undone.
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
              {pending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Pre-flight size check, returning a reason or null. The server validates each
 * file, but the Server Action body limit applies to the batch as a whole, so a
 * set of individually-legal files can still exceed it. Catching both here stops
 * an oversize upload before it leaves the browser, where the host would reject
 * it with a 413 that reads as a page crash rather than a message.
 */
export function tooLarge(batch: File[]): string | null {
  const cap = formatBytes(MAX_PROOF_BYTES);
  const over = batch.find((f) => f.size > MAX_PROOF_BYTES);
  if (over) {
    return `${over.name} is ${formatBytes(over.size)}. The limit is ${cap} per file.`;
  }
  const total = batch.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_PROOF_BYTES) {
    return `Those ${batch.length} files total ${formatBytes(total)}. Upload them in batches of ${cap} or less.`;
  }
  return null;
}

/** Compact file uploader: stage files, optional caption, then upload. */
function Uploader({ taskId }: { taskId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState('');
  const [pending, start] = useTransition();

  function pick(list: FileList | null) {
    if (!list || list.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function upload() {
    if (files.length === 0) {
      toast.error('Choose at least one file');
      return;
    }
    const oversize = tooLarge(files);
    if (oversize) {
      toast.error(oversize);
      return;
    }
    const snapshot = files;
    const cap = caption;
    setFiles([]);
    setCaption('');
    start(async () => {
      const fd = new FormData();
      snapshot.forEach((f) => fd.append('proofs', f));
      if (cap.trim()) fd.set('caption', cap.trim());
      try {
        const res = await uploadInternalTaskProofs(taskId, fd);
        if (res.ok) {
          toast.success(
            snapshot.length === 1 ? 'Document uploaded' : 'Documents uploaded',
          );
          return;
        }
        toast.error(res.error ?? 'Upload failed');
      } catch {
        // A rejected action — a dropped connection, or a body-size 413 from
        // the host — would otherwise bubble to the route error boundary and
        // replace the whole page with "Couldn't load this page".
        toast.error('Upload failed. The file may be too large to send.');
      }
      setFiles(snapshot);
      setCaption(cap);
    });
  }

  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => pick(e.currentTarget.files)}
          disabled={pending}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Paperclip className="size-3.5" />
          Choose files
        </button>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Optional caption…"
          disabled={pending}
          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-xs outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/15"
        />
        <button
          type="button"
          onClick={upload}
          disabled={pending || files.length === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          Upload
        </button>
      </div>
      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {files.map((file, idx) => (
            <li
              key={`${file.name}-${idx}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-background py-1 pl-2 pr-1 text-xs"
            >
              <span className="truncate font-medium">{file.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {formatBytes(file.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeFile(idx)}
                disabled={pending}
                className="ml-0.5 grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
