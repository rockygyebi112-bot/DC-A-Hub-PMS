import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[200px] w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
      </div>
      <Skeleton className="h-[320px] w-full rounded-xl" />
    </div>
  );
}
