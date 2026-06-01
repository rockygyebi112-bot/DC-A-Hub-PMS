import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div>
      {/* PageHeader: back + title + area subtitle */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-72" />
        <SkeletonText width="9rem" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main: description */}
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="space-y-3 p-4">
              <Skeleton className="h-40 w-full rounded-md" />
              <div className="flex justify-end">
                <Skeleton className="h-8 w-36 rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: details + assignees */}
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-4 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <SkeletonText width="4rem" className="h-3" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="border-b px-4 py-3">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-2 p-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="size-7 rounded-full" />
                  <SkeletonText width="55%" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
