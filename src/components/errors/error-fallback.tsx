"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

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
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    // Surfaced in the server console (and any attached log drain) for triage.
    // The browser console will only show the redacted message + digest.
    // eslint-disable-next-line no-console
    console.error("[app error]", { digest: error?.digest, message: error?.message });
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <div className="rounded-2xl border bg-card p-8 shadow-card">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
            <AlertTriangle className="size-5" aria-hidden />
          </div>
          <div className="flex-1">
            <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            {error?.digest ? (
              <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                Reference: {error.digest}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {reset ? (
            <Button onClick={() => reset()}>Try again</Button>
          ) : null}
          <Button variant="outline" render={<Link href={homeHref} />}>
            {homeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
