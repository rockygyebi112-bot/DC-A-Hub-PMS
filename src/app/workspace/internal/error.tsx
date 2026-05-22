"use client";

import { ErrorFallback } from "@/components/errors/error-fallback";

export default function InternalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      error={error}
      reset={reset}
      title="Couldn't load this page"
      homeHref="/workspace/internal"
      homeLabel="Back to internal workspace"
    />
  );
}
