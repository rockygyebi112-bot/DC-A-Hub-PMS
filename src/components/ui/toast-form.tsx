"use client";

import { useTransition, type FormHTMLAttributes, type ReactNode } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * `redirect()` inside a server action throws a special error so the
 * framework can intercept it. We don't want to treat that as a toast
 * error — rethrow it so Next.js can complete the navigation.
 */
function isRedirectError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export type ToastFormResult = { ok: true } | { ok: false; error?: string };

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  /**
   * Server action that handles the submission. Must return an
   * `ActionResult`-shaped value so this wrapper knows whether to fire a
   * success or error toast.
   */
  action: (formData: FormData) => Promise<ToastFormResult | void>;
  /** Toast text on success. Pass `null` to suppress. */
  successMessage?: string | null;
  /** Fallback toast text on error if the action didn't include one. */
  errorMessage?: string;
  /** Refresh server data after a successful action. Defaults to true so
   *  RSC pages re-render with the new state without a full reload. */
  refreshOnSuccess?: boolean;
  children: ReactNode;
};

/**
 * Drop-in replacement for <form action={serverAction}> that surfaces a
 * sonner toast on success/failure. Server actions still own validation
 * and revalidatePath() — this component only wires user feedback that
 * was previously missing on the page.
 */
export function ToastForm({
  action,
  successMessage = "Saved",
  errorMessage = "Something went wrong",
  refreshOnSuccess = true,
  className,
  children,
  ...rest
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      {...rest}
      className={cn(className)}
      onSubmit={(event) => {
        event.preventDefault();
        const formEl = event.currentTarget;
        const fd = new FormData(formEl);
        startTransition(async () => {
          try {
            const result = await action(fd);
            // Server actions that don't return a value are treated as
            // success — they would have thrown on failure.
            if (!result || result.ok) {
              if (successMessage) toast.success(successMessage);
              if (refreshOnSuccess) router.refresh();
            } else {
              toast.error(result.error ?? errorMessage);
            }
          } catch (err) {
            if (isRedirectError(err)) throw err;
            console.error("ToastForm action threw", err);
            toast.error(errorMessage);
          }
        });
      }}
      data-pending={pending ? "" : undefined}
    >
      {children}
    </form>
  );
}
