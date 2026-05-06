"use client";

import { KpiCard } from "@/components/dashboard/kpi-card";
import type { PortfolioHealth } from "@/lib/portfolio/types";

interface Props {
  data: PortfolioHealth;
}

export function HealthKpis({ data }: Props) {
  const onTrackPct =
    data.active_projects > 0
      ? Math.round((data.on_track_count / data.active_projects) * 100)
      : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Active Projects"
        value={data.active_projects}
        accent="blue"
        sublabel={`${data.done_projects} completed`}
      />
      <KpiCard
        label="On Track"
        value={`${onTrackPct}%`}
        accent="green"
        sublabel={`${data.on_track_count} of ${data.active_projects} projects`}
      />
      <KpiCard
        label="At Risk or Blocked"
        value={data.at_risk_or_blocked}
        accent={data.at_risk_or_blocked > 0 ? "pink" : "amber"}
        sublabel={
          data.at_risk_or_blocked > 0
            ? "Need leadership attention"
            : "All projects on track"
        }
      />
      <KpiCard
        label="Overdue Activities"
        value={data.overdue_activities}
        accent={data.overdue_activities > 0 ? "pink" : "teal"}
        sublabel={
          data.overdue_activities > 0
            ? "Across the portfolio"
            : "No overdue work"
        }
      />
    </div>
  );
}
