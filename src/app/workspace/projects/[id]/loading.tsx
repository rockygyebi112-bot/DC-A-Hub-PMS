import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="mb-5 flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, col) => (
          <div
            key={col}
            className="space-y-3 rounded-lg border border-border bg-card p-4"
          >
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 4 }).map((_, row) => (
              <Skeleton key={row} className="h-14 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
