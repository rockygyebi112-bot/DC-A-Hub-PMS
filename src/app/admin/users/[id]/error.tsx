"use client";

import { ErrorFallback } from "@/components/errors/error-fallback";

export default function UserDetailError({
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
      title="Couldn't load this user"
      homeHref="/admin/users"
      homeLabel="Back to users"
    />
  );
}
