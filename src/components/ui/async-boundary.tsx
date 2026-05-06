"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------
// Loading Spinner
// ------------------------------------------------------------------

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: "size-4 border-2",
  md: "size-6 border-[2.5px]",
  lg: "size-8 border-[3px]",
};

export function LoadingSpinner({
  label = "Loading…",
  className,
  size = "md",
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 text-muted-foreground", className)}
    >
      <span
        className={cn(
          "inline-block rounded-full border-current border-t-transparent animate-spin",
          SIZE_MAP[size],
        )}
        aria-hidden="true"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}

// ------------------------------------------------------------------
// Error Fallback
// ------------------------------------------------------------------

interface ErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorFallback({
  title = "Something went wrong",
  message = "We couldn’t load the data. Please try again.",
  onRetry,
  className,
}: ErrorFallbackProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300",
        className,
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-sm mt-1">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-sm font-medium underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 rounded px-1 -mx-1"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Empty State
// ------------------------------------------------------------------

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = "No results",
  description = "There’s nothing to show right now.",
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-6",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {icon && (
        <div className="mb-3 text-muted-foreground" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ------------------------------------------------------------------
// Async Boundary
// ------------------------------------------------------------------

interface AsyncBoundaryProps {
  loading?: boolean;
  error?: Error | null;
  empty?: boolean;
  loadingFallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  emptyFallback?: React.ReactNode;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function AsyncBoundary({
  loading = false,
  error = null,
  empty = false,
  loadingFallback,
  errorFallback,
  emptyFallback,
  onRetry,
  children,
  className,
}: AsyncBoundaryProps) {
  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        {loadingFallback ?? <LoadingSpinner />}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("py-4", className)}>
        {errorFallback ?? (
          <ErrorFallback
            title={error.name || "Error"}
            message={error.message}
            onRetry={onRetry}
          />
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className={className}>
        {emptyFallback ?? <EmptyState />}
      </div>
    );
  }

  return <>{children}</>;
}
