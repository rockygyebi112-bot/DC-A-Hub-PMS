"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchAttentionRows,
  fetchDeliveryTrend,
  fetchPortfolioHealth,
  fetchWorkload,
} from "@/lib/portfolio/queries";
import type {
  AttentionRow,
  DeliveryTrendPoint,
  PortfolioHealth,
  Timeframe,
  WorkloadRow,
} from "@/lib/portfolio/types";
import { PortfolioSection } from "./portfolio-section";
import { HealthKpis } from "./health-kpis";
import { AttentionTable } from "./attention-table";
import { DeliveryTrend } from "./delivery-trend";
import { WorkloadChart } from "./workload-chart";

interface Props {
  programSlug: string;
}

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "quarter", label: "Quarter" },
  { value: "ytd", label: "Year to date" },
];

function isTimeframe(value: string | null): value is Timeframe {
  return value === "30d" || value === "quarter" || value === "ytd";
}

export function DeliveryDashboard({ programSlug }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const timeframeParam = params.get("timeframe");
  const timeframe: Timeframe = isTimeframe(timeframeParam)
    ? timeframeParam
    : "30d";

  const [health, setHealth] = useState<PortfolioHealth | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);

  const [attention, setAttention] = useState<AttentionRow[] | null>(null);
  const [attentionErr, setAttentionErr] = useState<string | null>(null);

  const [trend, setTrend] = useState<DeliveryTrendPoint[] | null>(null);
  const [trendErr, setTrendErr] = useState<string | null>(null);

  const [workload, setWorkload] = useState<WorkloadRow[] | null>(null);
  const [workloadErr, setWorkloadErr] = useState<string | null>(null);

  const loadHealth = useCallback(() => {
    setHealthErr(null);
    fetchPortfolioHealth(programSlug)
      .then(setHealth)
      .catch((e: Error) => setHealthErr(e.message));
  }, [programSlug]);

  const loadAttention = useCallback(() => {
    setAttentionErr(null);
    fetchAttentionRows(programSlug, 10)
      .then(setAttention)
      .catch((e: Error) => setAttentionErr(e.message));
  }, [programSlug]);

  const loadTrend = useCallback(() => {
    setTrendErr(null);
    fetchDeliveryTrend(programSlug, timeframe)
      .then(setTrend)
      .catch((e: Error) => setTrendErr(e.message));
  }, [programSlug, timeframe]);

  const loadWorkload = useCallback(() => {
    setWorkloadErr(null);
    fetchWorkload(programSlug, 10)
      .then(setWorkload)
      .catch((e: Error) => setWorkloadErr(e.message));
  }, [programSlug]);

  useEffect(() => {
    loadHealth();
    loadAttention();
    loadTrend();
    loadWorkload();
  }, [loadHealth, loadAttention, loadTrend, loadWorkload]);

  const setTimeframeParam = useCallback(
    (value: Timeframe) => {
      const next = new URLSearchParams(params.toString());
      next.set("timeframe", value);
      router.replace(`/dashboard?${next.toString()}`);
    },
    [params, router],
  );

  const trendHeader = useMemo(
    () => (
      <div className="inline-flex rounded border border-border overflow-hidden">
        {TIMEFRAMES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTimeframeParam(t.value)}
            className={`px-3 py-1 text-xs font-semibold ${
              timeframe === t.value
                ? "bg-srsf-green-500/10 text-srsf-green-600"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    ),
    [timeframe, setTimeframeParam],
  );

  return (
    <div>
      <PortfolioSection
        title="Delivery Health"
        loading={health === null && !healthErr}
        error={healthErr}
        onRetry={loadHealth}
      >
        {health && <HealthKpis data={health} />}
      </PortfolioSection>

      <PortfolioSection
        title="Projects Requiring Attention"
        loading={attention === null && !attentionErr}
        error={attentionErr}
        onRetry={loadAttention}
      >
        {attention && <AttentionTable rows={attention} />}
      </PortfolioSection>

      <PortfolioSection
        title="Delivery Trend"
        loading={trend === null && !trendErr}
        error={trendErr}
        onRetry={loadTrend}
        headerRight={trendHeader}
      >
        {trend && <DeliveryTrend points={trend} />}
      </PortfolioSection>

      <PortfolioSection
        title="Workload Distribution"
        loading={workload === null && !workloadErr}
        error={workloadErr}
        onRetry={loadWorkload}
      >
        {workload && <WorkloadChart rows={workload} />}
      </PortfolioSection>
    </div>
  );
}
