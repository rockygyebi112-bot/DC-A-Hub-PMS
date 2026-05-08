import { StatusPill } from "@/components/admin/ui/status-pill";

export function ActivityStatus({
  status,
}: {
  status: "not_started" | "in_progress" | "done";
}) {
  if (status === "done") return <StatusPill status="completed" />;
  if (status === "in_progress") return <StatusPill status="active" />;
  return <StatusPill status="planning" />;
}

