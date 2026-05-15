"use client";

import { ErrorFallback } from "@/components/errors/error-fallback";

export default function PortalProjectError({
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
      title="Couldn't load this project"
      homeHref="/portal"
      homeLabel="Back to portal"
    />
  );
}
