import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div>
      {/* PageHeader */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-64" />
        <SkeletonText width="22rem" />
      </div>

      {/* Filter chips: area row + status row */}
      <div className="mb-5 space-y-2">
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-full" />
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      </div>

      {/* Board: 4 status columns (matches TaskBoard) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, c) => (
          <div
            key={c}
            className="rounded-xl border border-border bg-muted/30 p-3"
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-5 w-6 rounded-full" />
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <SkeletonText width="80%" className="h-4" />
                  <div className="mt-3 flex items-center justify-between">
                    <SkeletonText width="40%" />
                    <Skeleton className="size-7 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
