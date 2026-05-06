import { Flag } from "lucide-react";
import type { ActivityPriority } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

const COLOR: Record<ActivityPriority, string> = {
  low: "text-muted-foreground",
  medium: "text-blue-600 dark:text-blue-400",
  high: "text-red-600 dark:text-red-400",
};

export function PriorityFlag({
  priority,
  className,
}: {
  priority: ActivityPriority;
  className?: string;
}) {
  return (
    <Flag
      className={cn("w-3.5 h-3.5", COLOR[priority], className)}
      aria-label={`${priority} priority`}
    />
  );
}
