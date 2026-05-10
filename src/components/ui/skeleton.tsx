import { cn } from "@/lib/utils";

/**
 * Content-shaped loading placeholder. Use instead of spinners for
 * perceived-performance boost.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-md bg-muted/70",
        className
      )}
      {...props}
    />
  );
}

/** Single line of placeholder text. `width` controls the horizontal fill. */
export function SkeletonText({
  className,
  width = "100%",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { width?: string | number }) {
  return (
    <Skeleton
      style={{ width, ...(props.style ?? {}) }}
      className={cn("h-3.5 rounded-md", className)}
      {...props}
    />
  );
}

/** Circular placeholder — avatars, icon buttons. */
export function SkeletonCircle({
  className,
  size = 36,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { size?: number }) {
  return (
    <Skeleton
      style={{ width: size, height: size, ...(props.style ?? {}) }}
      className={cn("rounded-full", className)}
      {...props}
    />
  );
}

/** Card-shaped placeholder with a title row and body lines. */
export function SkeletonCard({
  className,
  lines = 3,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-card",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <SkeletonCircle size={36} />
        <div className="flex-1 space-y-2">
          <SkeletonText width="40%" />
          <SkeletonText width="25%" className="h-3" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonText
            key={i}
            width={i === lines - 1 ? "60%" : "100%"}
          />
        ))}
      </div>
    </div>
  );
}
