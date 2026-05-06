"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export type TrendResult = { value: number; label: string } | undefined;

export interface PeriodInput {
  /** Unique key to identify this KPI in the returned record */
  key: string;
  /** Supabase table name */
  table: string;
  /** Current period start (YYYY-MM-DD). Empty string = use default 30-day window */
  from: string;
  /** Current period end (YYYY-MM-DD). Empty string = use default 30-day window */
  to: string;
}

function getDefaultPeriods() {
  const now = new Date();
  const currentTo = now.toISOString().slice(0, 10);
  const currentFrom = new Date(now.getTime() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const prevToDate = new Date(new Date(currentFrom).getTime() - 86_400_000);
  const prevTo = prevToDate.toISOString().slice(0, 10);
  const prevFrom = new Date(prevToDate.getTime() - 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return { currentFrom, currentTo, prevFrom, prevTo };
}

function getPreviousPeriod(from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diffMs = toDate.getTime() - fromDate.getTime();
  const prevToDate = new Date(fromDate.getTime() - 86_400_000);
  const prevFromDate = new Date(prevToDate.getTime() - diffMs);
  return {
    prevFrom: prevFromDate.toISOString().slice(0, 10),
    prevTo: prevToDate.toISOString().slice(0, 10),
  };
}

/**
 * Returns trend data (% change vs previous period) for each input.
 * When from/to are empty strings, defaults to last 30 days vs prior 30 days.
 * Returns `undefined` for a key when both periods have zero data.
 */
export function usePreviousPeriodCounts(
  inputs: PeriodInput[]
): Record<string, TrendResult> {
  const [trends, setTrends] = useState<Record<string, TrendResult>>({});
  const supabase = createClient();

  // Serialize inputs so the effect only re-runs when values actually change
  const serialized = JSON.stringify(inputs);

  useEffect(() => {
    const parsed: PeriodInput[] = JSON.parse(serialized);
    const defaults = getDefaultPeriods();
    let isMounted = true;

    async function load() {
      const results: Record<string, TrendResult> = {};

      await Promise.all(
        parsed.map(async ({ key, table, from, to }) => {
          const isDefault = !from && !to;
          const currentFrom = from || defaults.currentFrom;
          const currentTo = to || defaults.currentTo;
          const label = isDefault ? "vs last month" : "vs prior period";
          const { prevFrom, prevTo } =
            from && to
              ? getPreviousPeriod(from, to)
              : { prevFrom: defaults.prevFrom, prevTo: defaults.prevTo };

          const [currentRes, prevRes] = await Promise.all([
            supabase
              .from(table)
              .select("*", { count: "exact", head: true })
              .eq("is_draft", false)
              .gte("created_at", currentFrom)
              .lte("created_at", `${currentTo}T23:59:59`),
            supabase
              .from(table)
              .select("*", { count: "exact", head: true })
              .eq("is_draft", false)
              .gte("created_at", prevFrom)
              .lte("created_at", `${prevTo}T23:59:59`),
          ]);

          // Suppress trend if either query errored
          if (currentRes.error || prevRes.error) {
            results[key] = undefined;
            return;
          }

          const current = currentRes.count ?? 0;
          const prev = prevRes.count ?? 0;

          if (current === 0 && prev === 0) {
            results[key] = undefined;
          } else if (prev === 0) {
            results[key] = { value: 100, label };
          } else {
            results[key] = {
              value: Math.round(((current - prev) / prev) * 100 * 10) / 10,
              label,
            };
          }
        })
      );

      if (isMounted) setTrends(results);
    }

    load();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  return trends;
}
