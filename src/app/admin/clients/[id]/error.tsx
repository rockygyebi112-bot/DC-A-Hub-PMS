"use client";

import { ErrorFallback } from "@/components/errors/error-fallback";

export default function ClientDetailError({
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
      title="Couldn't load this client"
      homeHref="/admin/clients"
      homeLabel="Back to clients"
    />
  );
}
