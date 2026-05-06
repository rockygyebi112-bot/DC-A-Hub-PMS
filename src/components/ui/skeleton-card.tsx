"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  rows?: number;
  hasHeader?: boolean;
  hasFooter?: boolean;
}

function SkeletonBlock({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export const SkeletonCard = React.memo(function SkeletonCard({
  className,
  rows = 3,
  hasHeader = true,
  hasFooter = true,
}: SkeletonCardProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden",
        className,
      )}
    >
      {/* Header stripe */}
      {hasHeader && <SkeletonBlock className="h-[3px] w-full" />}

      <div className="p-4 space-y-3">
        {hasHeader && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <SkeletonBlock className="size-[30px] rounded-[8px]" />
              <SkeletonBlock className="h-4 w-32" />
            </div>
            <SkeletonBlock className="h-5 w-16 rounded-full" />
          </div>
        )}

        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonBlock
            key={i}
            className={cn("h-3", i === rows - 1 ? "w-3/4" : "w-full")}
          />
        ))}

        {hasFooter && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <SkeletonBlock className="h-3 w-20" />
            <div className="flex gap-1">
              <SkeletonBlock className="h-4 w-14 rounded" />
              <SkeletonBlock className="h-4 w-14 rounded" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
