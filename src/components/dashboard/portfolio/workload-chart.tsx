"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import { EChart } from "@/components/dashboard/echart";
import { stackedBarChartOption } from "@/components/dashboard/chart-builders";
import type { WorkloadRow } from "@/lib/portfolio/types";

interface Props {
  rows: WorkloadRow[];
}

export function WorkloadChart({ rows }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const seriesData = useMemo(() => {
    const onTrack: Record<string, number> = {};
    const overdue: Record<string, number> = {};
    for (const r of rows) {
      const onTrackCount = Math.max(0, r.open_count - r.overdue_count);
      onTrack[r.full_name] = onTrackCount;
      overdue[r.full_name] = r.overdue_count;
    }
    return [
      { name: "On track", data: onTrack },
      { name: "Overdue", data: overdue },
    ];
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        No open activities assigned.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <EChart option={stackedBarChartOption(seriesData, "Open Activities by Owner", isDark)} />
    </div>
  );
}
