import { SkeletonCard, SkeletonText } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonText width="180px" className="h-5" />
        <SkeletonText width="260px" className="h-3" />
      </div>
      <SkeletonCard lines={2} />
      <SkeletonCard lines={4} />
    </div>
  );
}
