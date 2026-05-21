import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-9 w-full max-w-md" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[160px] w-full rounded-xl" />
      ))}
    </div>
  );
}
