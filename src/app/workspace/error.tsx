"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[workspace error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 shadow-card">
        <h1 className="font-heading text-xl font-bold text-destructive">
          Something went wrong loading this page
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The error is shown below to help debugging. This boundary is temporary.
        </p>
        <pre className="mt-4 overflow-auto rounded-lg bg-muted p-3 text-xs">
{`Message: ${error?.message ?? "(no message)"}
Name:    ${error?.name ?? "(no name)"}
Digest:  ${error?.digest ?? "(no digest)"}
Stack:   ${error?.stack ?? "(no stack)"}`}
        </pre>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
