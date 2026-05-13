"use client";

import { useRef, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/admin/ui/user-avatar";

type Props = {
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  user: { name: string; email: string; avatarUrl: string | null };
};

/**
 * Inline "Write an update…" composer that appears under the Updates feed.
 * Posts a free-text note as an `activity_log` row; the page re-renders the
 * feed via revalidatePath in the server action.
 */
export function UpdateComposer({ action, user }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const note = String(formData.get("note") ?? "").trim();
    if (!note) {
      toast.error("Write something first.");
      return;
    }
    startTransition(async () => {
      const res = await action(formData);
      if (!res.ok) {
        toast.error(res.error ?? "Could not post update");
        return;
      }
      formRef.current?.reset();
      inputRef.current?.focus();
    });
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="flex items-start gap-3 rounded-2xl border bg-background p-2.5 pl-3 transition-shadow focus-within:shadow-sm focus-within:ring-2 focus-within:ring-primary/15"
    >
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
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="size-3.5" />
          Post
        </button>
      </div>
    </form>
  );
}
