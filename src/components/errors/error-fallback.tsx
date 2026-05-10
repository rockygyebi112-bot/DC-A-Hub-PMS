"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Copy, LifeBuoy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Production-safe error UI shown when a server component throws.
 *
 * Never expose `error.message` / `error.stack` to end users — they may contain
 * database identifiers, query fragments or internal paths. Only the Next.js
 * `digest` is shown so support can grep server logs for the matching event.
 *
 * In development, Next's own dev overlay still shows the full stack on top of
 * this fallback, so DX is unchanged.
 */
export function ErrorFallback({
  error,
  reset,
  title = "Something went wrong",
  description = "An unexpected error occurred. The team has been notified. Please try again.",
  homeHref = "/",
  homeLabel = "Go home",
  supportHref = "mailto:support@dcahub.test",
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
  supportHref?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Surfaced in the server console (and any attached log drain) for triage.
    // The browser console will only show the redacted message + digest.
    // eslint-disable-next-line no-console
    console.error("[app error]", { digest: error?.digest, message: error?.message });
  }, [error]);

  async function copyReference() {
    if (!error?.digest) return;
    try {
      await navigator.clipboard.writeText(error.digest);
      setCopied(true);
      toast.success("Reference copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy reference");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16" role="alert" aria-live="assertive">
      <div className="rounded-2xl border bg-card p-8 shadow-card">
        <div className="flex items-start gap-3">
          <div
            className="rounded-lg bg-destructive/10 p-2 text-destructive"
            aria-hidden
          >
            <AlertTriangle className="size-5" />
          </div>
          <div className="flex-1">
            <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            {error?.digest ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Reference
                </span>
                <code className="flex-1 truncate font-mono text-[11px] text-foreground/80">
                  {error.digest}
                </code>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={copyReference}
                  aria-label="Copy reference"
                >
                  {copied ? (
                    <Check className="size-3" aria-hidden />
                  ) : (
                    <Copy className="size-3" aria-hidden />
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {reset ? (
            <Button onClick={() => reset()}>
              <RotateCcw className="size-4" aria-hidden />
              Try again
            </Button>
          ) : null}
          <Button variant="outline" render={<Link href={homeHref} />}>
            {homeLabel}
          </Button>
          <Button variant="ghost" render={<a href={supportHref} />}>
            <LifeBuoy className="size-4" aria-hidden />
            Contact support
          </Button>
        </div>
      </div>
    </div>
  );
}
