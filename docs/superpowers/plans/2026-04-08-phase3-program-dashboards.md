# Phase 3: Program Dashboards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 4 interactive program dashboards (Enterprise Spotlight, Virtual University, Hangout, ABSA Onboarding) with KPI cards, Apache ECharts visualizations, date range filters, and Excel export — reading data entered via the Phase 2 Data Entry module.

**Architecture:** Each dashboard is a client component that fetches its program's entries from Supabase (browser client, RLS-filtered), aggregates data client-side, and renders KPI cards + ECharts charts. A generic `EChart` wrapper handles rendering/resizing. Shared chart builder functions convert raw entry data into ECharts options (DRY — same builder for donut/bar/pie across dashboards). Virtual University and Hangout share a single dashboard component. The `[slug]/page.tsx` routes to the correct dashboard based on URL.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Apache ECharts, Tailwind CSS v4, shadcn/ui (base-ui), Supabase (browser client), xlsx (Excel export)

**Project directory:** `C:\Users\ishma\Desktop\springboard-mis`

---

## File Structure

```
springboard-mis/
├── src/
│   ├── components/
│   │   └── dashboard/
│   │       ├── echart.tsx                              # Generic ECharts React wrapper
│   │       ├── chart-builders.ts                       # Functions that generate ECharts options from data
│   │       ├── kpi-card.tsx                            # KPI metric card with value + label
│   │       ├── date-range-filter.tsx                   # Two date inputs for filtering
│   │       ├── export-button.tsx                       # Download data as Excel
│   │       ├── enterprise-spotlight-dashboard.tsx       # ES dashboard: 2 KPIs + 11 charts
│   │       ├── media-program-dashboard.tsx             # Shared VU/Hangout: 2 KPIs + 7 charts + table
│   │       └── absa-onboarding-dashboard.tsx           # ABSA dashboard: 1 KPI + 5 charts
│   └── app/
│       └── (dashboard)/
│           └── programs/
│               └── [slug]/
│                   └── page.tsx                        # MODIFY: route slug → dashboard component
```

---

### Task 1: Install ECharts + Create Chart Wrapper

**Files:**
- Create: `src/components/dashboard/echart.tsx`

- [ ] **Step 1: Install echarts**

Run: `npm install echarts`
Expected: echarts added to package.json dependencies

- [ ] **Step 2: Create the EChart wrapper component**

Create `src/components/dashboard/echart.tsx`:

```tsx
"use client";

import { useRef, useEffect } from "react";
import * as echarts from "echarts";

interface EChartProps {
  option: echarts.EChartsOption;
  height?: number;
  className?: string;
}

export function EChart({ option, height = 350, className }: EChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);

    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.setOption(option, { notMerge: true });
    }
  }, [option]);

  return (
    <div
      ref={chartRef}
      style={{ width: "100%", height }}
      className={className}
    />
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: "Compiled successfully" (ignore the pre-existing /login Suspense error)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/dashboard/echart.tsx
git commit -m "feat: install echarts and add generic EChart React wrapper"
```

---

### Task 2: Chart Builder Functions

**Files:**
- Create: `src/components/dashboard/chart-builders.ts`

These functions take raw entry data and produce ECharts option objects. They are reused across all dashboards.

- [ ] **Step 1: Create chart-builders.ts**

Create `src/components/dashboard/chart-builders.ts`:

```ts
import type { EChartsOption } from "echarts";

// SRSF brand chart palette — green, purple, then complementary colors
export const CHART_COLORS = [
  "#5BBF3A", // srsf green
  "#6B2D7B", // srsf purple
  "#3B82F6", // blue
  "#F59E0B", // amber
  "#EF4444", // red
  "#10B981", // emerald
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
  "#6366F1", // indigo
  "#84CC16", // lime
  "#06B6D4", // cyan
];

// ─── Data aggregation helpers ────────────────────────────────────

/** Count occurrences of each value for a given field */
export function countByField<T extends Record<string, unknown>>(
  entries: T[],
  field: keyof T
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const val = entry[field];
    if (val === null || val === undefined || val === "") continue;
    const key = String(val);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/** Sum a numeric field grouped by a categorical field */
export function sumByGroup<T extends Record<string, unknown>>(
  entries: T[],
  groupField: keyof T,
  sumField: keyof T
): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const entry of entries) {
    const group = String(entry[groupField] ?? "Unknown");
    const val = Number(entry[sumField]) || 0;
    sums[group] = (sums[group] || 0) + val;
  }
  return sums;
}

/** Group entries by month (YYYY-MM) from a date field */
export function groupByMonth<T extends Record<string, unknown>>(
  entries: T[],
  dateField: keyof T
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const entry of entries) {
    const dateVal = entry[dateField];
    if (!dateVal) continue;
    const month = String(dateVal).slice(0, 7); // "2026-04"
    if (!groups[month]) groups[month] = [];
    groups[month].push(entry);
  }
  return groups;
}

// ─── Chart option builders ───────────────────────────────────────

/** Vertical bar chart from counts */
export function barChartOption(
  counts: Record<string, number>,
  title: string
): EChartsOption {
  const categories = Object.keys(counts);
  const values = Object.values(counts);
  return {
    title: { text: title, left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: { rotate: categories.length > 6 ? 30 : 0, fontSize: 11 },
    },
    yAxis: { type: "value" },
    series: [
      {
        type: "bar",
        data: values,
        itemStyle: { color: CHART_COLORS[0] },
        barMaxWidth: 50,
      },
    ],
    grid: { bottom: categories.length > 6 ? 80 : 40, containLabel: true },
    color: CHART_COLORS,
  };
}

/** Horizontal bar chart from counts (good for long category names) */
export function horizontalBarChartOption(
  counts: Record<string, number>,
  title: string
): EChartsOption {
  // Sort descending by value
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const categories = sorted.map(([k]) => k);
  const values = sorted.map(([, v]) => v);
  return {
    title: { text: title, left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value" },
    yAxis: {
      type: "category",
      data: categories,
      inverse: true,
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        type: "bar",
        data: values,
        itemStyle: { color: CHART_COLORS[0] },
        barMaxWidth: 30,
      },
    ],
    grid: { left: 120, containLabel: false },
    color: CHART_COLORS,
  };
}

/** Donut chart from counts */
export function donutChartOption(
  counts: Record<string, number>,
  title: string
): EChartsOption {
  const data = Object.entries(counts).map(([name, value]) => ({
    name,
    value,
  }));
  return {
    title: { text: title, left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, type: "scroll" },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        center: ["50%", "50%"],
        data,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: "bold" },
        },
      },
    ],
    color: CHART_COLORS,
  };
}

/** Pie chart from counts (full circle, not donut) */
export function pieChartOption(
  counts: Record<string, number>,
  title: string
): EChartsOption {
  const data = Object.entries(counts).map(([name, value]) => ({
    name,
    value,
  }));
  return {
    title: { text: title, left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, type: "scroll" },
    series: [
      {
        type: "pie",
        radius: "65%",
        center: ["50%", "50%"],
        data,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: "bold" },
        },
      },
    ],
    color: CHART_COLORS,
  };
}

/** Line chart from monthly data points */
export function lineChartOption(
  monthlyData: Record<string, number>,
  title: string,
  seriesName: string
): EChartsOption {
  const months = Object.keys(monthlyData).sort();
  const values = months.map((m) => monthlyData[m]);
  return {
    title: { text: title, left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: months },
    yAxis: { type: "value" },
    series: [
      {
        name: seriesName,
        type: "line",
        data: values,
        smooth: true,
        itemStyle: { color: CHART_COLORS[0] },
        areaStyle: { opacity: 0.1 },
      },
    ],
    color: CHART_COLORS,
  };
}

/** Stacked bar chart — multiple series stacked on categories */
export function stackedBarChartOption(
  seriesData: { name: string; data: Record<string, number> }[],
  title: string
): EChartsOption {
  // Collect all categories from all series
  const categorySet = new Set<string>();
  for (const s of seriesData) {
    for (const k of Object.keys(s.data)) categorySet.add(k);
  }
  const categories = Array.from(categorySet).sort();

  return {
    title: { text: title, left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, type: "scroll" },
    xAxis: { type: "category", data: categories },
    yAxis: { type: "value" },
    series: seriesData.map((s, i) => ({
      name: s.name,
      type: "bar" as const,
      stack: "total",
      data: categories.map((c) => s.data[c] || 0),
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    })),
    grid: { bottom: 60, containLabel: true },
    color: CHART_COLORS,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/chart-builders.ts
git commit -m "feat: add chart builder functions for ECharts (bar, donut, pie, line, stacked)"
```

---

### Task 3: Shared Dashboard Components (KPI Card, Date Filter, Export)

**Files:**
- Create: `src/components/dashboard/kpi-card.tsx`
- Create: `src/components/dashboard/date-range-filter.tsx`
- Create: `src/components/dashboard/export-button.tsx`

- [ ] **Step 1: Create KPI card component**

Create `src/components/dashboard/kpi-card.tsx`:

```tsx
interface KpiCardProps {
  label: string;
  value: string | number;
}

export function KpiCard({ label, value }: KpiCardProps) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: Create date range filter component**

Create `src/components/dashboard/date-range-filter.tsx`:

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear: () => void;
}

export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  onClear,
}: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="w-40"
        />
      </div>
      {(from || to) && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create export button component**

Create `src/components/dashboard/export-button.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
  columns?: { key: string; label: string }[];
}

export function ExportButton({ data, filename, columns }: ExportButtonProps) {
  function handleExport() {
    if (data.length === 0) return;

    let sheetData: Record<string, unknown>[];
    if (columns) {
      sheetData = data.map((row) => {
        const obj: Record<string, unknown> = {};
        for (const col of columns) {
          obj[col.label] = row[col.key];
        }
        return obj;
      });
    } else {
      sheetData = data;
    }

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4 mr-1" />
      Export Excel
    </Button>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: "Compiled successfully"

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/kpi-card.tsx src/components/dashboard/date-range-filter.tsx src/components/dashboard/export-button.tsx
git commit -m "feat: add shared dashboard components (KPI card, date filter, export button)"
```

---

### Task 4: Enterprise Spotlight Dashboard

**Files:**
- Create: `src/components/dashboard/enterprise-spotlight-dashboard.tsx`

This dashboard shows 2 KPI cards and 11 charts from enterprise_spotlight_entries data.

- [ ] **Step 1: Create the Enterprise Spotlight dashboard**

Create `src/components/dashboard/enterprise-spotlight-dashboard.tsx`:

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { EnterpriseSpotlightEntry } from "@/lib/types";
import { EChart } from "./echart";
import { KpiCard } from "./kpi-card";
import { DateRangeFilter } from "./date-range-filter";
import { ExportButton } from "./export-button";
import {
  countByField,
  barChartOption,
  horizontalBarChartOption,
  donutChartOption,
  pieChartOption,
} from "./chart-builders";

export function EnterpriseSpotlightDashboard() {
  const [entries, setEntries] = useState<EnterpriseSpotlightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const supabase = createClient();

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

  // KPIs
  const totalApplications = filtered.length;
  const uniqueRegions = new Set(
    filtered.map((e) => e.region).filter(Boolean)
  ).size;

  // Chart data
  const regionCounts = useMemo(
    () => countByField(filtered, "region"),
    [filtered]
  );
  const genderCounts = useMemo(
    () => countByField(filtered, "gender"),
    [filtered]
  );
  const ageCounts = useMemo(
    () => countByField(filtered, "age_bracket"),
    [filtered]
  );
  const disabilityCounts = useMemo(
    () => countByField(filtered, "disability_status"),
    [filtered]
  );
  const disabilityTypeCounts = useMemo(
    () =>
      countByField(
        filtered.filter((e) => e.disability_status === "Yes"),
        "disability_type"
      ),
    [filtered]
  );
  const ownershipCounts = useMemo(
    () => countByField(filtered, "ownership_type"),
    [filtered]
  );
  const businessSizeCounts = useMemo(
    () => countByField(filtered, "business_size"),
    [filtered]
  );
  const fundingCounts = useMemo(
    () => countByField(filtered, "funding_status"),
    [filtered]
  );
  const registrationCounts = useMemo(
    () => countByField(filtered, "business_registered"),
    [filtered]
  );
  const sectorCounts = useMemo(
    () => countByField(filtered, "business_sector"),
    [filtered]
  );

  // Business longevity: group into ranges
  const longevityCounts = useMemo(() => {
    const ranges: Record<string, number> = {
      "0-1 years": 0,
      "2-5 years": 0,
      "6-10 years": 0,
      "11-20 years": 0,
      "20+ years": 0,
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
    return <p className="text-muted-foreground py-8">Loading dashboard...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onClear={() => {
            setFrom("");
            setTo("");
          }}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Applications" value={totalApplications} />
        <KpiCard label="Regions Represented" value={uniqueRegions} />
      </div>

      {/* Charts — Row 1: Regional + Gender + Age */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <EChart option={barChartOption(regionCounts, "Regional Representation")} />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart option={donutChartOption(genderCounts, "Gender Distribution")} />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart option={barChartOption(ageCounts, "Age Bracket")} />
        </div>
      </div>

      {/* Charts — Row 2: Disability + Ownership + Longevity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={donutChartOption(disabilityCounts, "Disability Status")}
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={barChartOption(disabilityTypeCounts, "Disability Type")}
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={pieChartOption(ownershipCounts, "Ownership Type")}
          />
        </div>
      </div>

      {/* Charts — Row 3: Longevity + Size + Funding */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={barChartOption(longevityCounts, "Business Longevity")}
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={barChartOption(businessSizeCounts, "Business Size")}
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={pieChartOption(fundingCounts, "Funding Status")}
          />
        </div>
      </div>

      {/* Charts — Row 4: Registration + Sector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={donutChartOption(
              registrationCounts,
              "Registration Status"
            )}
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={horizontalBarChartOption(sectorCounts, "Business Sector")}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/enterprise-spotlight-dashboard.tsx
git commit -m "feat: add Enterprise Spotlight dashboard with 2 KPIs and 11 charts"
```

---

### Task 5: Media Program Dashboard (Virtual University + Hangout)

**Files:**
- Create: `src/components/dashboard/media-program-dashboard.tsx`

This shared component handles both Virtual University and Hangout. It displays 2 KPI cards, 7 charts, and a sortable/searchable episode data table. The `tableName` and `programLabel` props differentiate between VU and Hangout.

- [ ] **Step 1: Create the media program dashboard**

Create `src/components/dashboard/media-program-dashboard.tsx`:

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { MediaProgramEntry } from "@/lib/types";
import { EChart } from "./echart";
import { KpiCard } from "./kpi-card";
import { DateRangeFilter } from "./date-range-filter";
import { ExportButton } from "./export-button";
import {
  groupByMonth,
  barChartOption,
  donutChartOption,
  lineChartOption,
  stackedBarChartOption,
} from "./chart-builders";
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
  programLabel: string;
}

type SortField = "episode_title" | "date_aired" | "total_views";
type SortDir = "asc" | "desc";

export function MediaProgramDashboard({
  tableName,
  programLabel,
}: MediaProgramDashboardProps) {
  const [entries, setEntries] = useState<MediaProgramEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date_aired");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from(tableName)
        .select("*")
        .eq("is_draft", false)
        .order("created_at", { ascending: false });

      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", `${to}T23:59:59`);

      const { data } = await query;
      setEntries((data as MediaProgramEntry[]) ?? []);
      setLoading(false);
    }
    load();
  }, [supabase, tableName, from, to]);

  // Helper to get total views for an entry
  function totalViews(entry: MediaProgramEntry): number {
    let total = 0;
    if (entry.metrics.facebook) total += entry.metrics.facebook.views;
    if (entry.metrics.youtube) total += entry.metrics.youtube.views;
    return total;
  }

  function totalMetric(
    entry: MediaProgramEntry,
    field: "views" | "shares" | "saves" | "likes"
  ): number {
    let total = 0;
    if (entry.metrics.facebook) total += entry.metrics.facebook[field];
    if (entry.metrics.youtube) total += entry.metrics.youtube[field];
    return total;
  }

  // KPIs
  const totalEpisodes = entries.length;
  const totalViewsAll = entries.reduce((sum, e) => sum + totalViews(e), 0);

  // Monthly data for line/bar charts
  const monthlyGroups = useMemo(
    () => groupByMonth(entries, "date_aired"),
    [entries]
  );

  const monthlyViewTotals = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [month, monthEntries] of Object.entries(monthlyGroups)) {
      result[month] = (monthEntries as MediaProgramEntry[]).reduce(
        (sum, e) => sum + totalViews(e),
        0
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

  // Views per platform (stacked bar by month)
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

  // Shares/saves aggregated
  const totalSharesSaves = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [month, monthEntries] of Object.entries(monthlyGroups)) {
      result[month] = (monthEntries as MediaProgramEntry[]).reduce(
        (sum, e) => sum + totalMetric(e, "shares") + totalMetric(e, "saves"),
        0
      );
    }
    return result;
  }, [monthlyGroups]);

  // Likes aggregated
  const totalLikes = useMemo(() => {
    const result: Record<string, number> = {};
    for (const [month, monthEntries] of Object.entries(monthlyGroups)) {
      result[month] = (monthEntries as MediaProgramEntry[]).reduce(
        (sum, e) => sum + totalMetric(e, "likes"),
        0
      );
    }
    return result;
  }, [monthlyGroups]);

  // Demographics — aggregate across all entries
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
      for (const [k, v] of Object.entries(
        e.demographics?.age_brackets ?? {}
      )) {
        counts[k] = (counts[k] || 0) + v;
      }
    }
    return counts;
  }, [entries]);

  // Episode table — sorted + searched
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
        return sortDir === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
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
    return <p className="text-muted-foreground py-8">Loading dashboard...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onClear={() => {
            setFrom("");
            setTo("");
          }}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Episodes" value={totalEpisodes} />
        <KpiCard
          label="Total Views (All Platforms)"
          value={totalViewsAll.toLocaleString()}
        />
      </div>

      {/* Charts — Row 1: Monthly trend + Episodes aired + Views per platform */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={lineChartOption(
              monthlyViewTotals,
              "Monthly Trend Analysis",
              "Views"
            )}
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={barChartOption(
              monthlyEpisodeCounts,
              "Monthly Episodes Aired"
            )}
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={stackedBarChartOption(
              platformViewsByMonth,
              "Views per Platform"
            )}
          />
        </div>
      </div>

      {/* Charts — Row 2: Shares/Saves + Likes + Gender + Age */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={barChartOption(totalSharesSaves, "Shares / Saves")}
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart option={barChartOption(totalLikes, "Likes")} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={donutChartOption(genderCounts, "Gender Distribution")}
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart option={barChartOption(ageBracketCounts, "Age Bracket")} />
        </div>
      </div>

      {/* Episode Data Table */}
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("episode_title")}
                  >
                    Episode <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("date_aired")}
                  >
                    Date Aired <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSort("total_views")}
                  >
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
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    No episodes found.
                  </TableCell>
                </TableRow>
              ) : (
                tableRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.episode_title}
                    </TableCell>
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
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/media-program-dashboard.tsx
git commit -m "feat: add shared media program dashboard for VU and Hangout with 7 charts + episode table"
```

---

### Task 6: ABSA Onboarding Dashboard

**Files:**
- Create: `src/components/dashboard/absa-onboarding-dashboard.tsx`

This dashboard shows 1 KPI card and 5 charts from absa_onboarding_entries data.

- [ ] **Step 1: Create the ABSA Onboarding dashboard**

Create `src/components/dashboard/absa-onboarding-dashboard.tsx`:

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { AbsaOnboardingEntry } from "@/lib/types";
import { EChart } from "./echart";
import { KpiCard } from "./kpi-card";
import { DateRangeFilter } from "./date-range-filter";
import { ExportButton } from "./export-button";
import {
  countByField,
  barChartOption,
  donutChartOption,
  pieChartOption,
} from "./chart-builders";

export function AbsaOnboardingDashboard() {
  const [entries, setEntries] = useState<AbsaOnboardingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const supabase = createClient();

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

  // KPIs
  const totalParticipants = entries.length;

  // Chart data
  const genderCounts = useMemo(
    () => countByField(entries, "gender"),
    [entries]
  );
  const ageCounts = useMemo(
    () => countByField(entries, "age_bracket"),
    [entries]
  );
  const regionCounts = useMemo(
    () => countByField(entries, "region"),
    [entries]
  );
  const employmentCounts = useMemo(
    () => countByField(entries, "employment_status"),
    [entries]
  );
  const disabilityCounts = useMemo(
    () => countByField(entries, "disability_status"),
    [entries]
  );

  if (loading) {
    return <p className="text-muted-foreground py-8">Loading dashboard...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onClear={() => {
            setFrom("");
            setTo("");
          }}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Participants Onboarded" value={totalParticipants} />
      </div>

      {/* Charts — Row 1: Gender + Age + Region */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <EChart option={donutChartOption(genderCounts, "Gender Distribution")} />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart option={barChartOption(ageCounts, "Age Bracket")} />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart option={barChartOption(regionCounts, "Region")} />
        </div>
      </div>

      {/* Charts — Row 2: Employment + Disability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={pieChartOption(employmentCounts, "Employment Status")}
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <EChart
            option={donutChartOption(disabilityCounts, "Disability Status")}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/absa-onboarding-dashboard.tsx
git commit -m "feat: add ABSA Onboarding dashboard with 1 KPI and 5 charts"
```

---

### Task 7: Update Program Page Routing

**Files:**
- Modify: `src/app/(dashboard)/programs/[slug]/page.tsx`

Replace the placeholder page with routing logic that renders the correct dashboard based on the URL slug.

- [ ] **Step 1: Replace the program page**

Replace the entire contents of `src/app/(dashboard)/programs/[slug]/page.tsx` with:

```tsx
import { PROGRAMS } from "@/lib/constants";
import { notFound } from "next/navigation";
import { EnterpriseSpotlightDashboard } from "@/components/dashboard/enterprise-spotlight-dashboard";
import { MediaProgramDashboard } from "@/components/dashboard/media-program-dashboard";
import { AbsaOnboardingDashboard } from "@/components/dashboard/absa-onboarding-dashboard";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProgramPage({ params }: Props) {
  const { slug } = await params;
  const program = PROGRAMS.find((p) => p.slug === slug);

  if (!program) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{program.name}</h1>
      {slug === "enterprise-spotlight" && <EnterpriseSpotlightDashboard />}
      {slug === "virtual-university" && (
        <MediaProgramDashboard
          tableName="virtual_university_entries"
          programLabel="Virtual University"
        />
      )}
      {slug === "hangout" && (
        <MediaProgramDashboard
          tableName="hangout_entries"
          programLabel="Hangout"
        />
      )}
      {slug === "absa-onboarding" && <AbsaOnboardingDashboard />}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | head -20`
Expected: "Compiled successfully"

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/programs/[slug]/page.tsx
git commit -m "feat: route program pages to dashboard components by slug"
```

---

### Task 8: Build Verification

**Files:** None new — verification pass.

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`
Expected: Server starts on http://localhost:3000

- [ ] **Step 2: Verify Enterprise Spotlight dashboard**

Navigate to http://localhost:3000/programs/enterprise-spotlight and verify:
1. Date range filter appears at top with From/To inputs
2. Export Excel button is visible
3. KPI cards show "Total Applications" and "Regions Represented"
4. 11 charts render (bar, donut, pie, horizontal bar)
5. Charts show data if entries exist, or empty state if none

- [ ] **Step 3: Verify Virtual University dashboard**

Navigate to http://localhost:3000/programs/virtual-university and verify:
1. KPI cards show "Total Episodes" and "Total Views"
2. 7 charts render (line, bar, stacked bar, donut)
3. Episode data table appears below charts with sortable columns and search
4. Export button works

- [ ] **Step 4: Verify Hangout dashboard**

Navigate to http://localhost:3000/programs/hangout — should be identical structure to Virtual University.

- [ ] **Step 5: Verify ABSA Onboarding dashboard**

Navigate to http://localhost:3000/programs/absa-onboarding and verify:
1. KPI card shows "Total Participants Onboarded"
2. 5 charts render (donut, bar, pie)

- [ ] **Step 6: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: polish program dashboards after verification"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install ECharts + generic wrapper | `src/components/dashboard/echart.tsx` |
| 2 | Chart builder functions (bar, donut, pie, line, stacked, horizontal) | `src/components/dashboard/chart-builders.ts` |
| 3 | Shared components (KPI card, date filter, export button) | `kpi-card.tsx`, `date-range-filter.tsx`, `export-button.tsx` |
| 4 | Enterprise Spotlight dashboard (2 KPIs + 11 charts) | `enterprise-spotlight-dashboard.tsx` |
| 5 | Media Program dashboard — VU + Hangout (2 KPIs + 7 charts + table) | `media-program-dashboard.tsx` |
| 6 | ABSA Onboarding dashboard (1 KPI + 5 charts) | `absa-onboarding-dashboard.tsx` |
| 7 | Program page routing by slug | `src/app/(dashboard)/programs/[slug]/page.tsx` |
| 8 | Build verification + manual testing | — |

**Total charts:** 11 (ES) + 7 (VU) + 7 (Hangout, shared) + 5 (ABSA) = 30 chart instances across 4 dashboards, built from 6 reusable chart builder functions.

**Not included in this phase (deferred):**
- Executive Dashboard (Phase 4) — cross-program aggregation
- Dynamic custom indicator charts (Phase 5) — auto-generated from indicators table
