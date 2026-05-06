"use client";

import { ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Optional skeleton to render while loading. Defaults to a generic block. */
  skeleton?: ReactNode;
  /** Optional element rendered on the right side of the section heading. */
  headerRight?: ReactNode;
}

export function PortfolioSection({
  title,
  children,
  loading,
  error,
  onRetry,
  skeleton,
  headerRight,
}: Props) {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {headerRight}
      </div>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-center justify-between">
          <span>{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold underline"
            >
              Retry
            </button>
          )}
        </div>
      ) : loading ? (
        skeleton ?? (
          <div className="h-32 rounded-lg border border-border bg-muted/40 animate-pulse" />
        )
      ) : (
        children
      )}
    </section>
  );
}
