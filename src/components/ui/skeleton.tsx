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
      className={cn(
        "animate-pulse rounded-md bg-muted/70",
        className
      )}
      {...props}
    />
  );
}
