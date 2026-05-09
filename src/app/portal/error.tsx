"use client";

import { ErrorFallback } from "@/components/errors/error-fallback";

export default function PortalError({
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
      homeHref="/portal"
      homeLabel="Back to portal"
    />
  );
}
