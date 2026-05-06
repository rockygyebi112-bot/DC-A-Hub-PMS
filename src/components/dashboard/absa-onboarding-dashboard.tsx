"use client";

import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { AbsaOnboardingEntry } from "@/lib/types";
import { EChart } from "./echart";
import { KpiCard } from "./kpi-card";
import { DateRangeFilter } from "./date-range-filter";
import { ExportButton } from "./export-button";
import { usePreviousPeriodCounts } from "@/hooks/use-previous-period-counts";
import {
  countByField,
  barChartOption,
  horizontalBarChartOption,
  donutChartOption,
  pieChartOption,
} from "./chart-builders";
import { CustomIndicatorCharts } from "./custom-indicator-charts";
import { DashboardSkeleton } from "./dashboard-skeleton";

export function AbsaOnboardingDashboard() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [entries, setEntries] = useState<AbsaOnboardingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const supabase = createClient();

  const trendInputs = useMemo(
    () => [{ key: "participants", table: "absa_onboarding_entries", from, to }],
    [from, to]
  );
  const trends = usePreviousPeriodCounts(trendInputs);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("absa_onboarding_entries")
        .select("*")
        .eq("is_draft", false)
        .order("created_at", { ascending: false });

      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", `${to}T23:59:59`);

      const { data } = await query;
      setEntries((data as AbsaOnboardingEntry[]) ?? []);
      setLoading(false);
    }
    load();
  }, [supabase, from, to]);

  const totalParticipants = entries.length;

  const genderCounts = useMemo(() => countByField(entries, "gender"), [entries]);
  const ageCounts = useMemo(() => countByField(entries, "age_bracket"), [entries]);
  const regionCounts = useMemo(() => countByField(entries, "region"), [entries]);
  const employmentCounts = useMemo(() => countByField(entries, "employment_status"), [entries]);
  const disabilityCounts = useMemo(() => countByField(entries, "disability_status"), [entries]);

  if (loading) {
    return <DashboardSkeleton kpis={3} charts={4} />;
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-20 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-3 bg-background/85 backdrop-blur-md border-b border-border/50 flex flex-wrap items-end justify-between gap-4">
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onClear={() => { setFrom(""); setTo(""); }}
        />
        <ExportButton
          data={entries}
          filename="absa-onboarding-export"
          columns={[
            { key: "participant_name", label: "Participant" },
            { key: "gender", label: "Gender" },
            { key: "age", label: "Age" },
            { key: "age_bracket", label: "Age Bracket" },
            { key: "region", label: "Region" },
            { key: "employment_status", label: "Employment" },
            { key: "disability_status", label: "Disability" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Total Participants Onboarded" value={totalParticipants} trend={trends["participants"]} accent="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={donutChartOption(genderCounts, "Gender Distribution", isDark)} />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={barChartOption(ageCounts, "Age Bracket", isDark)} />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart
            option={horizontalBarChartOption(regionCounts, "Region", isDark)}
            height={320}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={pieChartOption(employmentCounts, "Employment Status", isDark)} />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={donutChartOption(disabilityCounts, "Disability Status", isDark)} />
        </div>
      </div>

      <CustomIndicatorCharts
        programSlug="absa-onboarding"
        entries={entries as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
