"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/admin/ui/user-avatar";

type Props = {
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  upload?: (formData: FormData) => void | Promise<void>;
  user: { name: string; email: string; avatarUrl: string | null };
};

/**
 * Inline "Write an update…" composer that appears under the Updates feed.
 * Posts a free-text note as an `activity_log` row; the page re-renders the
 * feed via revalidatePath in the server action.
 */
export function UpdateComposer({ action, upload, user }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  function pickFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setPendingFiles((prev) => [...prev, ...Array.from(list)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(idx: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function submit(formData: FormData) {
    const note = String(formData.get("note") ?? "").trim();
    if (!note && pendingFiles.length === 0) {
      toast.error("Write something or attach a file.");
      return;
    }
    // Snapshot so we can restore on failure.
    const filesToUpload = pendingFiles;
    // Eager reset: the input clears the instant the user hits Post. The
    // already-captured `formData` keeps the values the action needs, so
    // resetting the visible form does not affect the request.
    formRef.current?.reset();
    setPendingFiles([]);
    inputRef.current?.focus();
    startTransition(async () => {
      // Upload staged attachments first so the proof_added log row lands
      // before the note, keeping a sensible chronological order in the feed.
      if (filesToUpload.length > 0 && upload) {
        const fd = new FormData();
        filesToUpload.forEach((f) => fd.append("proofs", f));
        try {
          await upload(fd);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Upload failed");
          setPendingFiles(filesToUpload);
          return;
        }
      }
      if (note) {
        const res = await action(formData);
        if (!res.ok) {
          toast.error(res.error ?? "Could not post update");
          if (inputRef.current) inputRef.current.value = note;
          setPendingFiles(filesToUpload);
          return;
        }
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
          name="note"
          rows={1}
          placeholder="Write an update…"
          className="min-h-7 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          disabled={pending}
        />
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => pickFiles(e.currentTarget.files)}
            disabled={pending || !upload}
          />
          <button
            type="button"
            aria-label="Attach files"
            title="Attach files"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending || !upload}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <Paperclip className="size-4" />
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="size-3.5" />
            {pending ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
      {pendingFiles.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5 pl-9">
          {pendingFiles.map((file, idx) => (
            <li
              key={`${file.name}-${idx}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-muted/40 py-1 pl-2 pr-1 text-xs"
            >
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
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
    </form>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
