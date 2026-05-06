import type { ComputedProjectStatus } from "@/features/projects";
import { StatusBadge } from "@/components/ui/status-badge";

export function StatusPill({
  status,
  className,
}: {
  status: ComputedProjectStatus;
  className?: string;
}) {
  return <StatusBadge status={status} size="md" className={className} />;
}
