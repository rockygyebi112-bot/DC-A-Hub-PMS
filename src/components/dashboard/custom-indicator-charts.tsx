"use client";

import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { EChart } from "./echart";
import { KpiCard } from "./kpi-card";
import {
  donutChartOption,
  horizontalBarChartOption,
} from "./chart-builders";
import type { Indicator } from "@/lib/types";

interface CustomIndicatorChartsProps {
  programSlug: string;
  entries: Record<string, unknown>[];
  showOnExecutiveOnly?: boolean;
}

export function CustomIndicatorCharts({
  programSlug,
  entries,
  showOnExecutiveOnly = false,
}: CustomIndicatorChartsProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [indicators, setIndicators] = useState<Indicator[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: program } = await supabase
        .from("programs")
        .select("id")
        .eq("slug", programSlug)
        .single();
      if (!program) return;
      let query = supabase
        .from("indicators")
        .select("*")
        .eq("program_id", program.id)
        .eq("is_core", false)
        .eq("is_active", true);
      if (showOnExecutiveOnly) {
        query = query.eq("show_on_executive", true);
      }
      query = query.order("sort_order");
      const { data } = await query;
      setIndicators((data as Indicator[]) ?? []);
    }
    load();
  }, [programSlug, showOnExecutiveOnly]);

  const charts = useMemo(() => {
    if (indicators.length === 0) return null;

    return indicators.map((ind) => {
      if (ind.data_type === "numeric") {
        // Sum numeric values from custom_fields
        let total = 0;
        for (const entry of entries) {
          const cf = entry.custom_fields as Record<string, unknown> | undefined;
          if (!cf) continue;
          const val = Number(cf[ind.name]);
          if (!isNaN(val)) total += val;
        }
        return { type: "kpi" as const, indicator: ind, value: total };
      } else {
        // Count categorical values from custom_fields
        const counts: Record<string, number> = {};
        for (const entry of entries) {
          const cf = entry.custom_fields as Record<string, unknown> | undefined;
          if (!cf) continue;
          const val = cf[ind.name];
          if (val && typeof val === "string") {
            counts[val] = (counts[val] || 0) + 1;
          }
        }
        return { type: "chart" as const, indicator: ind, counts };
      }
    });
  }, [indicators, entries]);

  if (!charts || charts.length === 0) return null;

  const kpis = charts.filter((c) => c.type === "kpi");
  const categoricals = charts.filter((c) => c.type === "chart");

  return (
    <>
      {kpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((c) => (
            <KpiCard
              key={c.indicator.id}
              label={c.indicator.name}
              value={c.type === "kpi" ? c.value : 0}
            />
          ))}
        </div>
      )}
      {categoricals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {categoricals.map((c) => {
            const counts = c.type === "chart" ? c.counts : {};
            const hasData = Object.keys(counts).length > 0;
            return (
              <div key={c.indicator.id} className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
                {hasData ? (
                  <EChart
                    option={
                      Object.keys(counts).length <= 5
                        ? donutChartOption(counts, c.indicator.name, isDark)
                        : horizontalBarChartOption(counts, c.indicator.name, isDark)
                    }
                    height={Object.keys(counts).length > 5 ? 320 : undefined}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
                    No data yet for {c.indicator.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
