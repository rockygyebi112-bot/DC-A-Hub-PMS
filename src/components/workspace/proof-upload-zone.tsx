"use client";

import { useRef, useTransition } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

type Props = {
  // Matches Next server actions, which return `void | Promise<void>`.
  // We narrow the response at runtime in case the action chooses to
  // hand back `{ ok, error }` (the workspace `uploadProofs` does).
  action: (formData: FormData) => void | Promise<void>;
};

/**
 * Drag-and-drop / click-to-upload dashed zone wired to the existing
 * `uploadProofs` server action. Lives in a client component because the
 * dashed area auto-submits when files are picked or dropped — both of
 * which require event handlers that can't be serialised across the RSC
 * boundary.
 */
export function ProofUploadZone({ action }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    startTransition(async () => {
      try {
        await action(fd);
        formRef.current?.reset();
        toast.success("Files uploaded");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  return (
    <form
      ref={formRef}
      className="mt-4"
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (!files.length || !inputRef.current) return;
        const dt = new DataTransfer();
        files.forEach((f) => dt.items.add(f));
        inputRef.current.files = dt.files;
        submit();
      }}
    >
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-muted/30 px-4 py-5 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 ${
          pending ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <Upload className="size-5 text-muted-foreground" />
        <p className="text-xs font-medium text-foreground">
          {pending
            ? "Uploading…"
            : "Drag & drop files here or click to upload"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          PDF, DOC, XLS, PNG, JPG (Max 50MB)
        </p>
        <input
          ref={inputRef}
          type="file"
          name="proofs"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.currentTarget.files?.length) submit();
          }}
          disabled={pending}
        />
      </label>
    </form>
  );
}
