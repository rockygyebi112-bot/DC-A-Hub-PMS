"use client";

import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { EnterpriseSpotlightEntry } from "@/lib/types";
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
import React from "react";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 mt-2">
      <span className="w-[3px] h-[18px] rounded-full bg-srsf-green-500 shrink-0" />
      <h2 className="text-[13px] font-bold tracking-tight">{children}</h2>
    </div>
  );
}

export function EnterpriseSpotlightDashboard() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [entries, setEntries] = useState<EnterpriseSpotlightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const supabase = createClient();

  const trendInputs = useMemo(
    () => [{ key: "applications", table: "enterprise_spotlight_entries", from, to }],
    [from, to]
  );
  const trends = usePreviousPeriodCounts(trendInputs);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("enterprise_spotlight_entries")
        .select("*")
        .eq("is_draft", false)
        .order("created_at", { ascending: false });

      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", `${to}T23:59:59`);

      const { data } = await query;
      setEntries((data as EnterpriseSpotlightEntry[]) ?? []);
      setLoading(false);
    }
    load();
  }, [supabase, from, to]);

  const filtered = entries;

  const totalApplications = filtered.length;
  const uniqueRegions = new Set(
    filtered.map((e) => e.region).filter(Boolean)
  ).size;

  const regionCounts = useMemo(() => countByField(filtered, "region"), [filtered]);
  const genderCounts = useMemo(() => countByField(filtered, "gender"), [filtered]);
  const ageCounts = useMemo(() => countByField(filtered, "age_bracket"), [filtered]);
  const disabilityCounts = useMemo(() => countByField(filtered, "disability_status"), [filtered]);
  const disabilityTypeCounts = useMemo(
    () => countByField(filtered.filter((e) => e.disability_status === "Yes"), "disability_type"),
    [filtered]
  );
  const ownershipCounts = useMemo(() => countByField(filtered, "ownership_type"), [filtered]);
  const businessSizeCounts = useMemo(() => countByField(filtered, "business_size"), [filtered]);
  const fundingCounts = useMemo(() => countByField(filtered, "funding_status"), [filtered]);
  const registrationCounts = useMemo(() => countByField(filtered, "business_registered"), [filtered]);
  const sectorCounts = useMemo(() => countByField(filtered, "business_sector"), [filtered]);

  const longevityCounts = useMemo(() => {
    const ranges: Record<string, number> = {
      "0-1 years": 0, "2-5 years": 0, "6-10 years": 0, "11-20 years": 0, "20+ years": 0,
    };
    for (const e of filtered) {
      const y = e.business_longevity;
      if (y === null || y === undefined) continue;
      if (y <= 1) ranges["0-1 years"]++;
      else if (y <= 5) ranges["2-5 years"]++;
      else if (y <= 10) ranges["6-10 years"]++;
      else if (y <= 20) ranges["11-20 years"]++;
      else ranges["20+ years"]++;
    }
    return ranges;
  }, [filtered]);

  if (loading) {
    return <DashboardSkeleton kpis={4} charts={4} />;
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
          data={filtered}
          filename="enterprise-spotlight-export"
          columns={[
            { key: "applicant_name", label: "Applicant" },
            { key: "region", label: "Region" },
            { key: "gender", label: "Gender" },
            { key: "age", label: "Age" },
            { key: "age_bracket", label: "Age Bracket" },
            { key: "disability_status", label: "Disability" },
            { key: "ownership_type", label: "Ownership" },
            { key: "business_size", label: "Business Size" },
            { key: "funding_status", label: "Funding" },
            { key: "business_registered", label: "Registered" },
            { key: "business_sector", label: "Sector" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Total Applications" value={totalApplications} trend={trends["applications"]} accent="green" />
        <KpiCard label="Regions Represented" value={uniqueRegions} accent="teal" />
      </div>

      <SectionHeading>Geographic</SectionHeading>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart
            option={horizontalBarChartOption(regionCounts, "Regional Representation", isDark)}
            height={320}
          />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={donutChartOption(genderCounts, "Gender Distribution", isDark)} />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={barChartOption(ageCounts, "Age Bracket", isDark)} />
        </div>
      </div>

      <SectionHeading>Demographics</SectionHeading>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={donutChartOption(disabilityCounts, "Disability Status", isDark)} />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart
            option={barChartOption(disabilityTypeCounts, "Disability Type", isDark)}
            height={Math.max(280, Object.keys(disabilityTypeCounts).length * 40 + 90)}
          />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={pieChartOption(ownershipCounts, "Ownership Type", isDark)} />
        </div>
      </div>

      <SectionHeading>Business Information</SectionHeading>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={barChartOption(longevityCounts, "Business Longevity", isDark)} />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={barChartOption(businessSizeCounts, "Business Size", isDark)} />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={pieChartOption(fundingCounts, "Funding Status", isDark)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={donutChartOption(registrationCounts, "Registration Status", isDark)} />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={horizontalBarChartOption(sectorCounts, "Business Sector", isDark)} />
        </div>
      </div>

      <CustomIndicatorCharts
        programSlug="enterprise-spotlight"
        entries={filtered as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
