import { Skeleton } from "@/components/ui/skeleton";

/**
 * Content-shaped loading placeholder for dashboards.
 * Roughly mirrors: filter bar → KPI row → chart grid.
 */
export function DashboardSkeleton({ kpis = 4, charts = 4 }: { kpis?: number; charts?: number }) {
  return (
    <div className="space-y-8">
      {/* Filter row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-9 w-80" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: kpis }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-3"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-2 w-16" />
          </div>
        ))}
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: charts }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-4"
          >
            <Skeleton className="h-4 w-40 mx-auto" />
            <Skeleton className="h-56 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Table-shaped skeleton for data tables.
 */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <div
        className="grid gap-4 border-b border-border/60 pb-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-24" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-4 py-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 w-full max-w-32" />
          ))}
        </div>
      ))}
    </div>
  );
}
