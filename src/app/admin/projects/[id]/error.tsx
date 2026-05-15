"use client";

import { ErrorFallback } from "@/components/errors/error-fallback";

export default function ProjectDetailError({
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
      homeHref="/admin/projects"
      homeLabel="Back to projects"
    />
  );
}
