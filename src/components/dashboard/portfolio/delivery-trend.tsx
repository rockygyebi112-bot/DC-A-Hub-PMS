"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import { EChart } from "@/components/dashboard/echart";
import { lineChartOption } from "@/components/dashboard/chart-builders";
import type { DeliveryTrendPoint } from "@/lib/portfolio/types";

interface Props {
  points: DeliveryTrendPoint[];
}

export function DeliveryTrend({ points }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const data = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of points) out[p.bucket_label] = p.completed;
    return out;
  }, [points]);

  const total = points.reduce((s, p) => s + p.completed, 0);

  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        No activities have been completed in this timeframe.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <EChart
        option={lineChartOption(
          data,
          "Activities Completed Over Time",
          "Completed activities",
          isDark,
        )}
      />
    </div>
  );
}
