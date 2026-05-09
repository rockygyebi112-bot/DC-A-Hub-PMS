"use client";

import { ErrorFallback } from "@/components/errors/error-fallback";

export default function AdminError({
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
      homeHref="/admin"
      homeLabel="Back to admin"
    />
  );
}
