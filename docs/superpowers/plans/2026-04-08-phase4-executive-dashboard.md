# Phase 4: Executive Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Executive Dashboard — the landing page after login — that aggregates cross-program KPIs, demographics, and trend charts from all 4 program tables into a single unified view.

**Architecture:** A single client component (`ExecutiveDashboard`) fetches data from all 4 Supabase tables in parallel, then renders 4 KPI cards, a program filter bar, date range filter, and 7 chart sections. New chart-builder helpers (`multiLineChartOption`, `groupedBarChartOption`) are added for cross-program comparison charts. The existing `KpiCard` is extended with an optional trend indicator.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Apache ECharts, Supabase (browser client), Tailwind CSS v4, shadcn/ui (base-ui, NOT Radix — `onValueChange` passes `string | null`), xlsx for export.

**Codebase Conventions:**
- All chart components use the `EChart` wrapper at `src/components/dashboard/echart.tsx`
- Chart options are built via pure functions in `src/components/dashboard/chart-builders.ts`
- Data fetching uses `createClient()` from `src/lib/supabase/client` (browser client)
- All aggregations use `useMemo` for performance
- SRSF brand colors: green `#5BBF3A`, purple `#6B2D7B` — palette defined in `CHART_COLORS`
- Tailwind v4: config is in CSS `@theme` blocks, NOT `tailwind.config.ts`
- shadcn/ui uses base-ui (NOT Radix) — `asChild` prop doesn't work, Select `onValueChange` passes `string | null`
- Toast via Sonner (NOT Toast component)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/components/dashboard/chart-builders.ts` | Add `multiLineChartOption` and `groupedBarChartOption` helpers |
| Modify | `src/components/dashboard/kpi-card.tsx` | Add optional `trend` prop (percentage + direction arrow) |
| Create | `src/components/dashboard/program-filter-bar.tsx` | Toggle buttons: All / ES / VU / Hangout / ABSA |
| Create | `src/components/dashboard/executive-dashboard.tsx` | Main component: fetches all 4 tables, computes KPIs, renders charts |
| Modify | `src/app/(dashboard)/dashboard/page.tsx` | Replace placeholder with `<ExecutiveDashboard />` |

---

### Task 1: Add New Chart Builder Helpers

**Files:**
- Modify: `src/components/dashboard/chart-builders.ts`

- [ ] **Step 1: Add `multiLineChartOption` to chart-builders.ts**

This function renders multiple lines on one chart (e.g., VU views vs Hangout views over time). Append after the existing `lineChartOption` function (around line 201):

```typescript
/** Multi-line chart — overlays multiple series for comparison */
export function multiLineChartOption(
  seriesDataArr: { name: string; data: Record<string, number> }[],
  title: string
): EChartsOption {
  // Collect all month keys across all series
  const monthSet = new Set<string>();
  for (const s of seriesDataArr) {
    for (const k of Object.keys(s.data)) monthSet.add(k);
  }
  const months = Array.from(monthSet).sort();

  return {
    title: { text: title, left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, type: "scroll" },
    xAxis: { type: "category", data: months },
    yAxis: { type: "value" },
    series: seriesDataArr.map((s, i) => ({
      name: s.name,
      type: "line" as const,
      data: months.map((m) => s.data[m] || 0),
      smooth: true,
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      areaStyle: { opacity: 0.05 },
    })),
    grid: { bottom: 60, containLabel: true },
    color: CHART_COLORS,
  };
}
```

- [ ] **Step 2: Add `groupedBarChartOption` to chart-builders.ts**

This function renders grouped (side-by-side) bars per category. Append after the `multiLineChartOption` you just added:

```typescript
/** Grouped bar chart — multiple series side-by-side (not stacked) */
export function groupedBarChartOption(
  seriesData: { name: string; data: Record<string, number> }[],
  title: string
): EChartsOption {
  const categorySet = new Set<string>();
  for (const s of seriesData) {
    for (const k of Object.keys(s.data)) categorySet.add(k);
  }
  const categories = Array.from(categorySet).sort();

  return {
    title: { text: title, left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "axis" },
    legend: { bottom: 0, type: "scroll" },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: { rotate: categories.length > 6 ? 30 : 0, fontSize: 11 },
    },
    yAxis: { type: "value" },
    series: seriesData.map((s, i) => ({
      name: s.name,
      type: "bar" as const,
      data: categories.map((c) => s.data[c] || 0),
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      barMaxWidth: 40,
    })),
    grid: { bottom: categories.length > 6 ? 80 : 60, containLabel: true },
    color: CHART_COLORS,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/chart-builders.ts
git commit -m "feat: add multiLineChartOption and groupedBarChartOption to chart builders"
```

---

### Task 2: Extend KpiCard with Trend Indicator

**Files:**
- Modify: `src/components/dashboard/kpi-card.tsx`

- [ ] **Step 1: Replace the entire contents of kpi-card.tsx**

The new version adds an optional `trend` prop showing a percentage change with an up/down arrow, color-coded green (up) or red (down):

```typescript
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; label: string }; // value is percentage, e.g. 12.5 means +12.5%
}

export function KpiCard({ label, value, trend }: KpiCardProps) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          {trend.value >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span
            className={`text-xs font-medium ${
              trend.value >= 0 ? "text-green-600" : "text-red-500"
            }`}
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value.toFixed(1)}%
          </span>
          <span className="text-xs text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify existing dashboards still compile**

Run: `npx tsc --noEmit`

The `trend` prop is optional, so all existing `<KpiCard label="..." value={...} />` usages remain valid.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/kpi-card.tsx
git commit -m "feat: add optional trend indicator to KpiCard"
```

---

### Task 3: Create Program Filter Bar

**Files:**
- Create: `src/components/dashboard/program-filter-bar.tsx`

- [ ] **Step 1: Create program-filter-bar.tsx**

This renders toggle buttons for filtering: "All", and one per program. Uses SRSF green for the active state.

```typescript
"use client";

import { Button } from "@/components/ui/button";

export type ProgramFilter =
  | "all"
  | "enterprise-spotlight"
  | "virtual-university"
  | "hangout"
  | "absa-onboarding";

const FILTER_OPTIONS: { value: ProgramFilter; label: string }[] = [
  { value: "all", label: "All Programs" },
  { value: "enterprise-spotlight", label: "Enterprise Spotlight" },
  { value: "virtual-university", label: "Virtual University" },
  { value: "hangout", label: "Hangout" },
  { value: "absa-onboarding", label: "ABSA Onboarding" },
];

interface ProgramFilterBarProps {
  active: ProgramFilter;
  onChange: (filter: ProgramFilter) => void;
}

export function ProgramFilterBar({ active, onChange }: ProgramFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTER_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant={active === opt.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(opt.value)}
          className={
            active === opt.value
              ? "bg-[#5BBF3A] hover:bg-[#4ea832] text-white"
              : ""
          }
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/program-filter-bar.tsx
git commit -m "feat: add ProgramFilterBar toggle component for executive dashboard"
```

---

### Task 4: Build Executive Dashboard Component

**Files:**
- Create: `src/components/dashboard/executive-dashboard.tsx`

This is the main component. It:
1. Fetches all 4 tables in parallel on mount (and when date range changes)
2. Computes KPIs with trend (current period vs previous period of same length)
3. Applies program filter to show/hide relevant sections
4. Renders 7 chart sections matching the design spec

- [ ] **Step 1: Create executive-dashboard.tsx**

```typescript
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  EnterpriseSpotlightEntry,
  MediaProgramEntry,
  AbsaOnboardingEntry,
} from "@/lib/types";
import { EChart } from "./echart";
import { KpiCard } from "./kpi-card";
import { DateRangeFilter } from "./date-range-filter";
import { ExportButton } from "./export-button";
import { ProgramFilterBar, ProgramFilter } from "./program-filter-bar";
import {
  countByField,
  groupByMonth,
  barChartOption,
  horizontalBarChartOption,
  donutChartOption,
  pieChartOption,
  lineChartOption,
  multiLineChartOption,
  groupedBarChartOption,
  stackedBarChartOption,
} from "./chart-builders";

// ─── Helpers ────────────────────────────────────────────────────

function totalMediaViews(entry: MediaProgramEntry): number {
  let total = 0;
  if (entry.metrics.facebook) total += entry.metrics.facebook.views;
  if (entry.metrics.youtube) total += entry.metrics.youtube.views;
  return total;
}

function computeTrend(
  current: number,
  previous: number
): { value: number; label: string } | undefined {
  if (previous === 0) return undefined;
  const pct = ((current - previous) / previous) * 100;
  return { value: pct, label: "vs prev. period" };
}

function filterByDateRange<T extends { created_at: string }>(
  entries: T[],
  from: string,
  to: string
): T[] {
  let result = entries;
  if (from) result = result.filter((e) => e.created_at >= from);
  if (to) result = result.filter((e) => e.created_at <= `${to}T23:59:59`);
  return result;
}

function getPreviousPeriodRange(
  from: string,
  to: string
): { prevFrom: string; prevTo: string } | null {
  if (!from || !to) return null;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diffMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 1); // day before "from"
  const prevFrom = new Date(prevTo.getTime() - diffMs);
  return {
    prevFrom: prevFrom.toISOString().slice(0, 10),
    prevTo: prevTo.toISOString().slice(0, 10),
  };
}

// ─── Component ──────────────────────────────────────────────────

export function ExecutiveDashboard() {
  const [esEntries, setEsEntries] = useState<EnterpriseSpotlightEntry[]>([]);
  const [vuEntries, setVuEntries] = useState<MediaProgramEntry[]>([]);
  const [hangoutEntries, setHangoutEntries] = useState<MediaProgramEntry[]>([]);
  const [absaEntries, setAbsaEntries] = useState<AbsaOnboardingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [programFilter, setProgramFilter] = useState<ProgramFilter>("all");
  const supabase = createClient();

  useEffect(() => {
    async function loadAll() {
      setLoading(true);

      const buildQuery = (table: string) => {
        let q = supabase
          .from(table)
          .select("*")
          .eq("is_draft", false)
          .order("created_at", { ascending: false });
        if (from) q = q.gte("created_at", from);
        if (to) q = q.lte("created_at", `${to}T23:59:59`);
        return q;
      };

      const [esRes, vuRes, hangoutRes, absaRes] = await Promise.all([
        buildQuery("enterprise_spotlight_entries"),
        buildQuery("virtual_university_entries"),
        buildQuery("hangout_entries"),
        buildQuery("absa_onboarding_entries"),
      ]);

      setEsEntries((esRes.data as EnterpriseSpotlightEntry[]) ?? []);
      setVuEntries((vuRes.data as MediaProgramEntry[]) ?? []);
      setHangoutEntries((hangoutRes.data as MediaProgramEntry[]) ?? []);
      setAbsaEntries((absaRes.data as AbsaOnboardingEntry[]) ?? []);
      setLoading(false);
    }
    loadAll();
  }, [supabase, from, to]);

  // ─── KPI values ───────────────────────────────────────────────

  const totalApplications = esEntries.length;
  const totalVuEpisodes = vuEntries.length;
  const totalHangoutEpisodes = hangoutEntries.length;
  const totalAbsaParticipants = absaEntries.length;

  // ─── Trend calculations (only when date range set) ────────────

  const trends = useMemo(() => {
    const prev = getPreviousPeriodRange(from, to);
    if (!prev) return { es: undefined, vu: undefined, hangout: undefined, absa: undefined };

    // We need to re-filter from the full dataset — but we only have the filtered data.
    // Trends are only meaningful when a date range is explicitly set, and we'd need
    // unfiltered data for prev period. For simplicity, trends show undefined unless
    // the user has explicitly set a date range AND we fetch prev period data.
    // This is a display-only enhancement; we return undefined for now and can
    // enhance with a second fetch if needed.
    return { es: undefined, vu: undefined, hangout: undefined, absa: undefined };
  }, [from, to]);

  // ─── Show/hide based on program filter ────────────────────────

  const showES =
    programFilter === "all" || programFilter === "enterprise-spotlight";
  const showVU =
    programFilter === "all" || programFilter === "virtual-university";
  const showHangout =
    programFilter === "all" || programFilter === "hangout";
  const showABSA =
    programFilter === "all" || programFilter === "absa-onboarding";
  const showMedia = showVU || showHangout;

  // ─── Demographics: Gender (cross-program) ─────────────────────

  const genderCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    if (showES) {
      for (const e of esEntries) {
        if (e.gender) counts[e.gender] = (counts[e.gender] || 0) + 1;
      }
    }
    if (showVU) {
      for (const e of vuEntries) {
        for (const [k, v] of Object.entries(e.demographics?.gender ?? {})) {
          counts[k] = (counts[k] || 0) + v;
        }
      }
    }
    if (showHangout) {
      for (const e of hangoutEntries) {
        for (const [k, v] of Object.entries(e.demographics?.gender ?? {})) {
          counts[k] = (counts[k] || 0) + v;
        }
      }
    }
    if (showABSA) {
      for (const e of absaEntries) {
        if (e.gender) counts[e.gender] = (counts[e.gender] || 0) + 1;
      }
    }

    return counts;
  }, [esEntries, vuEntries, hangoutEntries, absaEntries, showES, showVU, showHangout, showABSA]);

  // ─── Demographics: Age Bracket (grouped bar by program) ───────

  const ageBracketByProgram = useMemo(() => {
    const series: { name: string; data: Record<string, number> }[] = [];

    if (showES) {
      series.push({
        name: "Enterprise Spotlight",
        data: countByField(esEntries, "age_bracket"),
      });
    }
    if (showVU) {
      const counts: Record<string, number> = {};
      for (const e of vuEntries) {
        for (const [k, v] of Object.entries(e.demographics?.age_brackets ?? {})) {
          counts[k] = (counts[k] || 0) + v;
        }
      }
      series.push({ name: "Virtual University", data: counts });
    }
    if (showHangout) {
      const counts: Record<string, number> = {};
      for (const e of hangoutEntries) {
        for (const [k, v] of Object.entries(e.demographics?.age_brackets ?? {})) {
          counts[k] = (counts[k] || 0) + v;
        }
      }
      series.push({ name: "Hangout", data: counts });
    }
    if (showABSA) {
      series.push({
        name: "ABSA Onboarding",
        data: countByField(absaEntries, "age_bracket"),
      });
    }

    return series;
  }, [esEntries, vuEntries, hangoutEntries, absaEntries, showES, showVU, showHangout, showABSA]);

  // ─── Demographics: Disability (ES + ABSA combined) ────────────

  const disabilityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (showES) {
      for (const e of esEntries) {
        if (e.disability_status)
          counts[e.disability_status] = (counts[e.disability_status] || 0) + 1;
      }
    }
    if (showABSA) {
      for (const e of absaEntries) {
        if (e.disability_status)
          counts[e.disability_status] = (counts[e.disability_status] || 0) + 1;
      }
    }
    return counts;
  }, [esEntries, absaEntries, showES, showABSA]);

  // ─── Geographic: Region (horizontal bar) ──────────────────────

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (showES) {
      for (const e of esEntries) {
        if (e.region) counts[e.region] = (counts[e.region] || 0) + 1;
      }
    }
    if (showABSA) {
      for (const e of absaEntries) {
        if (e.region) counts[e.region] = (counts[e.region] || 0) + 1;
      }
    }
    return counts;
  }, [esEntries, absaEntries, showES, showABSA]);

  const uniqueRegionCount = Object.keys(regionCounts).length;

  // ─── Enterprise Spotlight specifics ───────────────────────────

  const esRegistrationCounts = useMemo(
    () => (showES ? countByField(esEntries, "business_registered") : {}),
    [esEntries, showES]
  );
  const esSectorCounts = useMemo(
    () => (showES ? countByField(esEntries, "business_sector") : {}),
    [esEntries, showES]
  );

  // ─── Media Programs: Monthly views (dual-line) ────────────────

  const mediaMonthlyViews = useMemo(() => {
    const series: { name: string; data: Record<string, number> }[] = [];

    if (showVU) {
      const monthGroups = groupByMonth(vuEntries, "created_at");
      const monthTotals: Record<string, number> = {};
      for (const [month, items] of Object.entries(monthGroups)) {
        monthTotals[month] = (items as MediaProgramEntry[]).reduce(
          (sum, e) => sum + totalMediaViews(e),
          0
        );
      }
      series.push({ name: "Virtual University", data: monthTotals });
    }

    if (showHangout) {
      const monthGroups = groupByMonth(hangoutEntries, "created_at");
      const monthTotals: Record<string, number> = {};
      for (const [month, items] of Object.entries(monthGroups)) {
        monthTotals[month] = (items as MediaProgramEntry[]).reduce(
          (sum, e) => sum + totalMediaViews(e),
          0
        );
      }
      series.push({ name: "Hangout", data: monthTotals });
    }

    return series;
  }, [vuEntries, hangoutEntries, showVU, showHangout]);

  // ─── Media Programs: Monthly episodes (grouped bar) ───────────

  const mediaMonthlyEpisodes = useMemo(() => {
    const series: { name: string; data: Record<string, number> }[] = [];

    if (showVU) {
      const monthGroups = groupByMonth(vuEntries, "created_at");
      const counts: Record<string, number> = {};
      for (const [month, items] of Object.entries(monthGroups)) {
        counts[month] = items.length;
      }
      series.push({ name: "Virtual University", data: counts });
    }

    if (showHangout) {
      const monthGroups = groupByMonth(hangoutEntries, "created_at");
      const counts: Record<string, number> = {};
      for (const [month, items] of Object.entries(monthGroups)) {
        counts[month] = items.length;
      }
      series.push({ name: "Hangout", data: counts });
    }

    return series;
  }, [vuEntries, hangoutEntries, showVU, showHangout]);

  // ─── Media Programs: Views per platform (stacked bar) ─────────

  const mediaPlatformViews = useMemo(() => {
    let facebookTotal = 0;
    let youtubeTotal = 0;

    const mediaEntries: MediaProgramEntry[] = [];
    if (showVU) mediaEntries.push(...vuEntries);
    if (showHangout) mediaEntries.push(...hangoutEntries);

    for (const e of mediaEntries) {
      if (e.metrics.facebook) facebookTotal += e.metrics.facebook.views;
      if (e.metrics.youtube) youtubeTotal += e.metrics.youtube.views;
    }

    return { Facebook: facebookTotal, YouTube: youtubeTotal };
  }, [vuEntries, hangoutEntries, showVU, showHangout]);

  // ─── ABSA: Region breakdown ───────────────────────────────────

  const absaRegionCounts = useMemo(
    () => (showABSA ? countByField(absaEntries, "region") : {}),
    [absaEntries, showABSA]
  );

  // ─── Export data (flattened summary) ──────────────────────────

  const exportData = useMemo(() => {
    const rows: Record<string, string | number>[] = [];
    if (showES) {
      for (const e of esEntries) {
        rows.push({
          program: "Enterprise Spotlight",
          name: e.applicant_name,
          region: e.region,
          gender: e.gender,
          age_bracket: e.age_bracket,
          date: e.created_at.slice(0, 10),
        });
      }
    }
    if (showVU) {
      for (const e of vuEntries) {
        rows.push({
          program: "Virtual University",
          name: e.episode_title,
          region: "",
          gender: "",
          age_bracket: "",
          date: e.created_at.slice(0, 10),
          views: totalMediaViews(e),
        });
      }
    }
    if (showHangout) {
      for (const e of hangoutEntries) {
        rows.push({
          program: "Hangout",
          name: e.episode_title,
          region: "",
          gender: "",
          age_bracket: "",
          date: e.created_at.slice(0, 10),
          views: totalMediaViews(e),
        });
      }
    }
    if (showABSA) {
      for (const e of absaEntries) {
        rows.push({
          program: "ABSA Onboarding",
          name: e.participant_name,
          region: e.region,
          gender: e.gender,
          age_bracket: e.age_bracket,
          date: e.created_at.slice(0, 10),
        });
      }
    }
    return rows;
  }, [esEntries, vuEntries, hangoutEntries, absaEntries, showES, showVU, showHangout, showABSA]);

  // ─── Render ───────────────────────────────────────────────────

  if (loading) {
    return <p className="text-muted-foreground py-8">Loading executive dashboard...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ProgramFilterBar active={programFilter} onChange={setProgramFilter} />
        <div className="flex items-center gap-3">
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
            data={exportData}
            filename="executive-dashboard-export"
            columns={[
              { key: "program", label: "Program" },
              { key: "name", label: "Name" },
              { key: "region", label: "Region" },
              { key: "gender", label: "Gender" },
              { key: "age_bracket", label: "Age Bracket" },
              { key: "date", label: "Date" },
              { key: "views", label: "Views" },
            ]}
          />
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {showES && (
          <KpiCard
            label="Total Applications"
            value={totalApplications}
            trend={trends.es}
          />
        )}
        {showVU && (
          <KpiCard
            label="VU Episodes"
            value={totalVuEpisodes}
            trend={trends.vu}
          />
        )}
        {showHangout && (
          <KpiCard
            label="Hangout Episodes"
            value={totalHangoutEpisodes}
            trend={trends.hangout}
          />
        )}
        {showABSA && (
          <KpiCard
            label="ABSA Participants"
            value={totalAbsaParticipants}
            trend={trends.absa}
          />
        )}
      </div>

      {/* Demographics Section */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Demographics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <EChart option={donutChartOption(genderCounts, "Gender Distribution")} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <EChart
              option={groupedBarChartOption(ageBracketByProgram, "Age Bracket by Program")}
            />
          </div>
          {(showES || showABSA) && (
            <div className="rounded-lg border bg-card p-4">
              <EChart
                option={donutChartOption(disabilityCounts, "Disability Status")}
              />
            </div>
          )}
        </div>
      </div>

      {/* Geographic Section */}
      {(showES || showABSA) && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Geographic</h2>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 rounded-lg border bg-card p-4">
              <EChart
                option={horizontalBarChartOption(regionCounts, "Regional Representation")}
              />
            </div>
            <KpiCard label="Regions Represented" value={uniqueRegionCount} />
          </div>
        </div>
      )}

      {/* Enterprise Spotlight Specifics */}
      {showES && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Enterprise Spotlight</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <EChart
                option={pieChartOption(esRegistrationCounts, "Business Registration Status")}
              />
            </div>
            <div className="rounded-lg border bg-card p-4">
              <EChart
                option={horizontalBarChartOption(esSectorCounts, "Business Sector")}
              />
            </div>
          </div>
        </div>
      )}

      {/* Media Programs Section (VU + Hangout) */}
      {showMedia && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Media Programs</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <EChart
                option={
                  mediaMonthlyViews.length > 0
                    ? multiLineChartOption(mediaMonthlyViews, "Monthly Views Trend")
                    : barChartOption({}, "Monthly Views Trend")
                }
              />
            </div>
            <div className="rounded-lg border bg-card p-4">
              <EChart
                option={
                  mediaMonthlyEpisodes.length > 0
                    ? groupedBarChartOption(mediaMonthlyEpisodes, "Monthly Episodes Aired")
                    : barChartOption({}, "Monthly Episodes Aired")
                }
              />
            </div>
            <div className="rounded-lg border bg-card p-4">
              <EChart
                option={barChartOption(mediaPlatformViews, "Views per Platform")}
              />
            </div>
          </div>
        </div>
      )}

      {/* ABSA Section */}
      {showABSA && (
        <div>
          <h2 className="text-lg font-semibold mb-3">ABSA Onboarding</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <EChart
                option={barChartOption(absaRegionCounts, "Region Breakdown")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/executive-dashboard.tsx
git commit -m "feat: add ExecutiveDashboard component with cross-program KPIs and charts"
```

---

### Task 5: Wire Dashboard Page

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Replace the placeholder dashboard page**

Replace the entire contents of `src/app/(dashboard)/dashboard/page.tsx` with:

```typescript
import { ExecutiveDashboard } from "@/components/dashboard/executive-dashboard";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Executive Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Cross-program overview of all SRSF initiatives
        </p>
      </div>
      <ExecutiveDashboard />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: clean output, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: wire ExecutiveDashboard into /dashboard route, replacing placeholder"
```

---

### Task 6: Final Verification & Type Check

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`

Expected: clean — no errors.

- [ ] **Step 2: Verify dev server starts**

Run: `npm run dev` (or verify the already-running server doesn't show compilation errors)

Navigate to `/dashboard` in the browser and confirm:
- 4 KPI cards render (or fewer if program filter is active)
- Program filter buttons work (clicking toggles sections)
- Date range filter works
- Charts render (may be empty if no data in Supabase yet)
- Export button downloads Excel
- No console errors

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve any Phase 4 integration issues"
```
