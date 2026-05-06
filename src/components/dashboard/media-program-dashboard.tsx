"use client";

import { useState, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { MediaProgramEntry } from "@/lib/types";
import { EChart } from "./echart";
import { KpiCard } from "./kpi-card";
import { DateRangeFilter } from "./date-range-filter";
import { ExportButton } from "./export-button";
import {
  groupByGranularity,
  barChartOption,
  donutChartOption,
  lineChartOption,
  stackedBarChartOption,
} from "./chart-builders";
import type { Granularity } from "./chart-builders";
import { usePreviousPeriodCounts } from "@/hooks/use-previous-period-counts";
import { GranularityToggle } from "./granularity-toggle";
import { CustomIndicatorCharts } from "./custom-indicator-charts";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";

interface MediaProgramDashboardProps {
  tableName: "virtual_university_entries" | "hangout_entries";
  programSlug: string;
  programLabel: string;
}

type SortField = "episode_title" | "date_aired" | "total_views";
type SortDir = "asc" | "desc";

function totalMetric(
  entry: MediaProgramEntry,
  field: "views" | "shares" | "saves" | "likes"
): number {
  let total = 0;
  if (entry.metrics.facebook) total += entry.metrics.facebook[field];
  if (entry.metrics.youtube) total += entry.metrics.youtube[field];
  return total;
}

function totalViews(entry: MediaProgramEntry): number {
  return totalMetric(entry, "views");
}

export function MediaProgramDashboard({
  tableName,
  programSlug,
  programLabel,
}: MediaProgramDashboardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [entries, setEntries] = useState<MediaProgramEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date_aired");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [granularity, setGranularity] = useState<Granularity>("month");
  const periodLabel = granularity === "week" ? "Weekly" : granularity === "quarter" ? "Quarterly" : "Monthly";
  const supabase = createClient();

  const trendInputs = useMemo(
    () => [{ key: "episodes", table: tableName, from, to }],
    [tableName, from, to]
  );
  const trends = usePreviousPeriodCounts(trendInputs);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from(tableName)
        .select("*")
        .eq("is_draft", false)
        .order("date_aired", { ascending: false });

      if (from) query = query.gte("date_aired", from);
      if (to) query = query.lte("date_aired", to);

      const { data } = await query;
      setEntries((data as MediaProgramEntry[]) ?? []);
      setLoading(false);
    }
    load();
  }, [supabase, tableName, from, to]);

  const totalEpisodes = entries.length;
  const totalViewsAll = entries.reduce((sum, e) => sum + totalViews(e), 0);

  const monthlyGroups = useMemo(
    () => groupByGranularity(entries, "date_aired", granularity),
    [entries, granularity]
  );

  const monthlyViewTotals = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [month, monthEntries] of Object.entries(monthlyGroups)) {
      result[month] = (monthEntries as MediaProgramEntry[]).reduce(
        (sum, e) => sum + totalViews(e), 0
      );
    }
    return result;
  }, [monthlyGroups]);

  const monthlyEpisodeCounts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [month, monthEntries] of Object.entries(monthlyGroups)) {
      result[month] = monthEntries.length;
    }
    return result;
  }, [monthlyGroups]);

  const platformViewsByMonth = useMemo(() => {
    const facebook: Record<string, number> = {};
    const youtube: Record<string, number> = {};
    for (const [month, monthEntries] of Object.entries(monthlyGroups)) {
      facebook[month] = 0;
      youtube[month] = 0;
      for (const e of monthEntries as MediaProgramEntry[]) {
        if (e.metrics.facebook) facebook[month] += e.metrics.facebook.views;
        if (e.metrics.youtube) youtube[month] += e.metrics.youtube.views;
      }
    }
    return [
      { name: "Facebook", data: facebook },
      { name: "YouTube", data: youtube },
    ];
  }, [monthlyGroups]);

  const totalSharesSaves = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [month, monthEntries] of Object.entries(monthlyGroups)) {
      result[month] = (monthEntries as MediaProgramEntry[]).reduce(
        (sum, e) => sum + totalMetric(e, "shares") + totalMetric(e, "saves"), 0
      );
    }
    return result;
  }, [monthlyGroups]);

  const totalLikes = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [month, monthEntries] of Object.entries(monthlyGroups)) {
      result[month] = (monthEntries as MediaProgramEntry[]).reduce(
        (sum, e) => sum + totalMetric(e, "likes"), 0
      );
    }
    return result;
  }, [monthlyGroups]);

  const genderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      for (const [k, v] of Object.entries(e.demographics?.gender ?? {})) {
        counts[k] = (counts[k] || 0) + v;
      }
    }
    return counts;
  }, [entries]);

  const ageBracketCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      for (const [k, v] of Object.entries(e.demographics?.age_brackets ?? {})) {
        counts[k] = (counts[k] || 0) + v;
      }
    }
    return counts;
  }, [entries]);

  const tableRows = useMemo(() => {
    let rows = entries.map((e) => ({
      id: e.id,
      episode_title: e.episode_title,
      date_aired: e.date_aired ?? "",
      platforms: e.platforms.join(", "),
      total_views: totalViews(e),
      shares_saves: totalMetric(e, "shares") + totalMetric(e, "saves"),
      likes: totalMetric(e, "likes"),
    }));

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.episode_title.toLowerCase().includes(q));
    }

    rows.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });

    return rows;
  }, [entries, search, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

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
          data={tableRows}
          filename={`${programLabel.toLowerCase().replace(/ /g, "-")}-export`}
          columns={[
            { key: "episode_title", label: "Episode Title" },
            { key: "date_aired", label: "Date Aired" },
            { key: "platforms", label: "Platforms" },
            { key: "total_views", label: "Views" },
            { key: "shares_saves", label: "Shares/Saves" },
            { key: "likes", label: "Likes" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Total Episodes" value={totalEpisodes} trend={trends["episodes"]} accent="green" />
        <KpiCard label="Total Views (All Platforms)" value={totalViewsAll.toLocaleString()} accent="purple" />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Trends Over Time</h2>
          <GranularityToggle value={granularity} onChange={setGranularity} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <EChart option={lineChartOption(monthlyViewTotals, `${periodLabel} Trend Analysis`, "Views", isDark)} />
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <EChart option={barChartOption(monthlyEpisodeCounts, `${periodLabel} Episodes Aired`, isDark)} />
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <EChart option={stackedBarChartOption(platformViewsByMonth, "Views per Platform", isDark)} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={barChartOption(totalSharesSaves, "Shares / Saves", isDark)} />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={barChartOption(totalLikes, "Likes", isDark)} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={donutChartOption(genderCounts, "Gender Distribution", isDark)} />
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          <EChart option={barChartOption(ageBracketCounts, "Age Bracket", isDark)} />
        </div>
      </div>

      <CustomIndicatorCharts
        programSlug={programSlug}
        entries={entries as unknown as Record<string, unknown>[]}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold">Episode Data</h3>
          <Input
            placeholder="Search episodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("episode_title")}>
                    Episode <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("date_aired")}>
                    Date Aired <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => toggleSort("total_views")}>
                    Views <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Shares/Saves</TableHead>
                <TableHead>Likes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No episodes found.
                  </TableCell>
                </TableRow>
              ) : (
                tableRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.episode_title}</TableCell>
                    <TableCell>{row.date_aired || "—"}</TableCell>
                    <TableCell>{row.platforms || "—"}</TableCell>
                    <TableCell>{row.total_views.toLocaleString()}</TableCell>
                    <TableCell>{row.shares_saves.toLocaleString()}</TableCell>
                    <TableCell>{row.likes.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
