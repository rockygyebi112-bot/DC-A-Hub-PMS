# Dashboard Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real trend arrows to all KPI cards, a W/M/Q granularity toggle to all time-series charts, and comprehensive mobile responsiveness fixes across the SRSF MIS.

**Architecture:** A shared `usePreviousPeriodCounts` hook fires two parallel Supabase count queries (no rows fetched) per table — current period vs previous period — and returns shaped trend data. A `GranularityToggle` component drives a `granularity` state per dashboard, which is passed to a new `groupByGranularity` helper in chart-builders. Mobile fixes are Tailwind-only; no structural rewrites.

**Tech Stack:** Next.js (App Router), React, TypeScript, Supabase JS v2, ECharts, Tailwind CSS, shadcn/ui (base-ui, NOT Radix — `asChild` does not work, `Select.onValueChange` needs `?? ""` fallback)

---

## File Map

| Action | File |
|--------|------|
| **Modify** | `src/components/dashboard/chart-builders.ts` |
| **Create** | `src/components/dashboard/granularity-toggle.tsx` |
| **Create** | `src/hooks/use-previous-period-counts.ts` |
| **Modify** | `src/components/dashboard/echart.tsx` |
| **Modify** | `src/components/dashboard/program-filter-bar.tsx` |
| **Modify** | `src/components/layout/sidebar.tsx` |
| **Modify** | `src/components/layout/sidebar-nav-item.tsx` |
| **Modify** | `src/components/dashboard/executive-dashboard.tsx` |
| **Modify** | `src/components/dashboard/media-program-dashboard.tsx` |
| **Modify** | `src/components/dashboard/enterprise-spotlight-dashboard.tsx` |
| **Modify** | `src/components/dashboard/absa-onboarding-dashboard.tsx` |

---

## Task 1: Extend chart-builders with granularity helpers

**Files:**
- Modify: `src/components/dashboard/chart-builders.ts`

- [ ] **Step 1: Add Granularity type and groupByWeek/groupByQuarter/groupByGranularity**

Open `src/components/dashboard/chart-builders.ts`. Directly after the existing `groupByMonth` function (line ~99), insert:

```typescript
export type Granularity = "week" | "month" | "quarter";

/** Group entries by ISO week (YYYY-WNN) from a date field */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function groupByWeek<T extends Record<string, any>>(
  entries: T[],
  dateField: keyof T
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const entry of entries) {
    const dateVal = entry[dateField];
    if (!dateVal) continue;
    const d = new Date(String(dateVal));
    if (isNaN(d.getTime())) continue;
    // ISO week: step to Thursday of the same week, then get its year + week number
    const day = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
    const year = day.getUTCFullYear();
    const weekStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil(
      ((day.getTime() - weekStart.getTime()) / 86400000 + 1) / 7
    );
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }
  return groups;
}

/** Group entries by quarter (YYYY-QN) from a date field */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function groupByQuarter<T extends Record<string, any>>(
  entries: T[],
  dateField: keyof T
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const entry of entries) {
    const dateVal = entry[dateField];
    if (!dateVal) continue;
    const d = new Date(String(dateVal));
    if (isNaN(d.getTime())) continue;
    const year = d.getFullYear();
    const quarter = Math.ceil((d.getMonth() + 1) / 3);
    const key = `${year}-Q${quarter}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }
  return groups;
}

/** Delegate to the correct grouping function based on granularity */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function groupByGranularity<T extends Record<string, any>>(
  entries: T[],
  dateField: keyof T,
  granularity: Granularity
): Record<string, T[]> {
  switch (granularity) {
    case "week":
      return groupByWeek(entries, dateField);
    case "quarter":
      return groupByQuarter(entries, dateField);
    default:
      return groupByMonth(entries, dateField);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:\Users\ishma\Desktop\springboard-mis\.claude\worktrees\hungry-mendeleev"
npx tsc --noEmit
```

Expected: no errors related to chart-builders.ts

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/chart-builders.ts
git commit -m "feat: add groupByWeek, groupByQuarter, groupByGranularity helpers"
```

---

## Task 2: Create GranularityToggle component

**Files:**
- Create: `src/components/dashboard/granularity-toggle.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { Granularity } from "./chart-builders";

interface GranularityToggleProps {
  value: Granularity;
  onChange: (g: Granularity) => void;
}

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: "week", label: "W" },
  { value: "month", label: "M" },
  { value: "quarter", label: "Q" },
];

export function GranularityToggle({ value, onChange }: GranularityToggleProps) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden shrink-0">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1 text-xs font-medium transition-colors",
            value === opt.value
              ? "bg-srsf-green-500 text-white"
              : "bg-card text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/granularity-toggle.tsx
git commit -m "feat: add GranularityToggle component (W/M/Q)"
```

---

## Task 3: Create usePreviousPeriodCounts hook

**Files:**
- Create: `src/hooks/use-previous-period-counts.ts`

This hook fires Supabase `count` queries (no rows fetched) for the current and previous periods and returns trend data shaped for `KpiCard`'s existing `trend` prop.

- [ ] **Step 1: Create the file**

```typescript
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

          const current = currentRes.count ?? 0;
          const prev = prevRes.count ?? 0;

          if (current === 0 && prev === 0) {
            results[key] = undefined;
          } else if (prev === 0) {
            results[key] = { value: 100, label };
          } else {
            results[key] = {
              value:
                Math.round(((current - prev) / prev) * 100 * 10) / 10,
              label,
            };
          }
        })
      );

      setTrends(results);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  return trends;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-previous-period-counts.ts
git commit -m "feat: add usePreviousPeriodCounts hook for KPI trend arrows"
```

---

## Task 4: Make EChart height responsive

**Files:**
- Modify: `src/components/dashboard/echart.tsx`

Currently `height` defaults to `350` as an inline style, which cannot be made responsive. Change it so that when `height` is omitted the component uses a Tailwind responsive height class instead.

- [ ] **Step 1: Replace the file contents**

```tsx
"use client";

import { useRef, useEffect } from "react";
import * as echarts from "echarts";
import { cn } from "@/lib/utils";

interface EChartProps {
  option: echarts.EChartsOption;
  /** Explicit pixel height. When omitted, uses responsive Tailwind class h-56 lg:h-72 */
  height?: number;
  className?: string;
}

export function EChart({ option, height, className }: EChartProps) {
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
      style={{ width: "100%", ...(height !== undefined ? { height } : {}) }}
      className={cn(height === undefined ? "h-56 lg:h-72" : undefined, className)}
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/echart.tsx
git commit -m "feat: make EChart height responsive by default (h-56 lg:h-72)"
```

---

## Task 5: ProgramFilterBar — mobile Select fallback

**Files:**
- Modify: `src/components/dashboard/program-filter-bar.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProgramFilter =
  | "enterprise-spotlight"
  | "virtual-university"
  | "hangout"
  | "absa-onboarding";

const FILTER_OPTIONS: { value: ProgramFilter; label: string }[] = [
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
    <>
      {/* Mobile: compact Select dropdown */}
      <div className="sm:hidden w-full">
        <Select
          value={active}
          onValueChange={(v) => onChange((v ?? active) as ProgramFilter)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: tab strip */}
      <div className="hidden sm:flex flex-wrap gap-1 p-1 bg-muted rounded-lg">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              active === opt.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/program-filter-bar.tsx
git commit -m "feat: program filter bar shows Select on mobile, tabs on desktop"
```

---

## Task 6: Sidebar — collapsed icon nav + mobile close on navigate

**Files:**
- Modify: `src/components/layout/sidebar-nav-item.tsx`
- Modify: `src/components/layout/sidebar.tsx`

### 6a: Update SidebarNavItem to accept onNavigate callback

- [ ] **Step 1: Replace `src/components/layout/sidebar-nav-item.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/constants";

interface SidebarNavItemProps {
  item: NavItem;
  /** Called after a navigation link is clicked (used to close sidebar on mobile) */
  onNavigate?: () => void;
  /** When true, render icon-only mode (collapsed desktop sidebar) */
  iconOnly?: boolean;
}

export function SidebarNavItem({
  item,
  onNavigate,
  iconOnly = false,
}: SidebarNavItemProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(
    item.children?.some((child) => pathname.startsWith(child.href)) ?? false
  );

  const isActive =
    pathname === item.href ||
    item.children?.some((child) => pathname === child.href);

  const Icon = item.icon;

  // Icon-only mode: render a single icon link to the item's href (or first child)
  if (iconOnly) {
    const href = item.href;
    return (
      <Link
        href={href}
        onClick={onNavigate}
        title={item.label}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150",
          isActive
            ? "bg-srsf-green-500/20 text-white"
            : "text-white/60 hover:text-white hover:bg-white/8"
        )}
      >
        <Icon className="size-5 shrink-0" />
      </Link>
    );
  }

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
            isActive
              ? "bg-srsf-green-500/20 text-white"
              : "text-white/60 hover:text-white hover:bg-white/8"
          )}
        >
          <Icon className="size-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </button>
        {expanded && (
          <div className="ml-7 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "block px-2.5 py-1.5 rounded-md text-[13px] transition-all duration-150",
                  pathname === child.href
                    ? "bg-srsf-green-500/20 text-white font-medium"
                    : "text-white/50 hover:text-white hover:bg-white/8"
                )}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
        isActive
          ? "bg-srsf-green-500/20 text-white"
          : "text-white/60 hover:text-white hover:bg-white/8"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}
```

### 6b: Update Sidebar to pass onNavigate + render collapsed icon nav

- [ ] **Step 2: Replace `src/components/layout/sidebar.tsx`**

```tsx
"use client";

import Image from "next/image";
import { NAV_ITEMS } from "@/lib/constants";
import { SidebarNavItem } from "./sidebar-nav-item";
import { useUser } from "@/hooks/use-user";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { hasAccess, loading } = useUser();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => loading || hasAccess(item.module)
  );

  // Close sidebar on mobile when a nav link is clicked
  const handleNavigate = useCallback(() => {
    if (window.innerWidth < 1024) {
      setCollapsed(true);
    }
  }, []);

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-gradient-to-b from-srsf-purple-800 to-srsf-purple-900 transition-all duration-300 flex flex-col shadow-xl",
          collapsed ? "w-0 overflow-hidden lg:w-16" : "w-64"
        )}
      >
        {/* Logo / collapse button row */}
        <div
          className={cn(
            "flex items-center h-16 border-b border-white/10",
            collapsed ? "justify-center px-0" : "justify-between px-5"
          )}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <Image
                src="/srsf-logo.png"
                alt="SRSF"
                width={36}
                height={36}
                className="rounded-md"
              />
              <span className="text-lg font-bold text-white tracking-tight">
                SRSF MIS
              </span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-white/50 hover:text-white transition-colors hidden lg:block"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        {collapsed ? (
          /* Collapsed: icon-only nav (desktop only — hidden on mobile via w-0/overflow-hidden) */
          <nav className="flex-1 flex flex-col items-center py-5 gap-1 overflow-y-auto">
            {visibleItems.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                onNavigate={handleNavigate}
                iconOnly
              />
            ))}
          </nav>
        ) : (
          <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
            {visibleItems.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                onNavigate={handleNavigate}
              />
            ))}
          </nav>
        )}

        {/* Bottom branding (expanded only) */}
        {!collapsed && (
          <div className="px-5 py-4 border-t border-white/10">
            <p className="text-[11px] text-white/30 leading-relaxed">
              Springboard Road Show Foundation
            </p>
          </div>
        )}
      </aside>

      {/* Mobile toggle (shown when sidebar is hidden) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "fixed top-4 left-4 z-50 p-2 rounded-lg bg-srsf-purple-800 text-white shadow-lg lg:hidden",
          !collapsed && "hidden"
        )}
      >
        <PanelLeft className="w-5 h-5" />
      </button>
    </>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sidebar-nav-item.tsx src/components/layout/sidebar.tsx
git commit -m "feat: sidebar icon nav when collapsed, auto-close on mobile nav tap"
```

---

## Task 7: Wire trends + granularity into Executive Dashboard

**Files:**
- Modify: `src/components/dashboard/executive-dashboard.tsx`

- [ ] **Step 1: Add imports at the top of the file**

Add to the existing import block:

```typescript
import { usePreviousPeriodCounts } from "@/hooks/use-previous-period-counts";
import { GranularityToggle } from "./granularity-toggle";
import {
  // keep all existing imports, ADD:
  groupByGranularity,
} from "./chart-builders";
import type { Granularity } from "./chart-builders";
import { useMemo } from "react"; // already imported, ensure it stays
```

- [ ] **Step 2: Add granularity state and trend hook call**

Inside `ExecutiveDashboard()`, after the existing state declarations, add:

```typescript
const [granularity, setGranularity] = useState<Granularity>("month");

const trendInputs = useMemo(
  () => [
    { key: "es", table: "enterprise_spotlight_entries", from, to },
    { key: "vu", table: "virtual_university_entries", from, to },
    { key: "hangout", table: "hangout_entries", from, to },
    { key: "absa", table: "absa_onboarding_entries", from, to },
  ],
  [from, to]
);
const trends = usePreviousPeriodCounts(trendInputs);
```

- [ ] **Step 3: Replace the hardcoded `trends` useMemo (lines ~105-116) with the live hook result**

Delete the old `trends` useMemo block entirely (the one that returns all `undefined`):
```typescript
// DELETE this entire block:
const trends = useMemo(() => {
  const prev = getPreviousPeriodRange(from, to);
  if (!prev) return { es: undefined, vu: undefined, hangout: undefined, absa: undefined };
  return { es: undefined, vu: undefined, hangout: undefined, absa: undefined };
}, [from, to]);
```

And delete the now-unused `getPreviousPeriodRange` function (lines ~36-49) too.

- [ ] **Step 4: Pass trend data to KPI cards**

Find the KPI Summary Row section and update the four `KpiCard` calls:

```tsx
{showES && (
  <KpiCard
    label="Total Applications"
    value={totalApplications}
    trend={trends["es"]}
  />
)}
{showVU && (
  <KpiCard
    label="VU Episodes"
    value={totalVuEpisodes}
    trend={trends["vu"]}
  />
)}
{showHangout && (
  <KpiCard
    label="Hangout Episodes"
    value={totalHangoutEpisodes}
    trend={trends["hangout"]}
  />
)}
{showABSA && (
  <KpiCard
    label="ABSA Participants"
    value={totalAbsaParticipants}
    trend={trends["absa"]}
  />
)}
```

- [ ] **Step 5: Switch mediaMonthlyViews and mediaMonthlyEpisodes to use groupByGranularity**

Replace `groupByMonth(vuEntries, "created_at")` with `groupByGranularity(vuEntries, "created_at", granularity)` in both the `mediaMonthlyViews` and `mediaMonthlyEpisodes` useMemos. Do the same for `hangoutEntries`.

Example — `mediaMonthlyViews` becomes:
```typescript
const mediaMonthlyViews = useMemo(() => {
  const series: { name: string; data: Record<string, number> }[] = [];

  if (showVU) {
    const groups = groupByGranularity(vuEntries, "created_at", granularity);
    const totals: Record<string, number> = {};
    for (const [period, items] of Object.entries(groups)) {
      totals[period] = (items as MediaProgramEntry[]).reduce(
        (sum, e) => sum + totalMediaViews(e),
        0
      );
    }
    series.push({ name: "Virtual University", data: totals });
  }

  if (showHangout) {
    const groups = groupByGranularity(hangoutEntries, "created_at", granularity);
    const totals: Record<string, number> = {};
    for (const [period, items] of Object.entries(groups)) {
      totals[period] = (items as MediaProgramEntry[]).reduce(
        (sum, e) => sum + totalMediaViews(e),
        0
      );
    }
    series.push({ name: "Hangout", data: totals });
  }

  return series;
}, [vuEntries, hangoutEntries, showVU, showHangout, granularity]);
```

Apply the same pattern to `mediaMonthlyEpisodes`.

Also add `granularity` to the dependency arrays of both useMemos.

- [ ] **Step 6: Add GranularityToggle to the Media Programs section heading**

Find the Media Programs section heading:
```tsx
<h2 className="text-base font-semibold text-gray-800 mb-4">Media Programs</h2>
```

Replace with:
```tsx
<div className="flex items-center justify-between mb-4">
  <h2 className="text-base font-semibold text-gray-800">Media Programs</h2>
  <GranularityToggle value={granularity} onChange={setGranularity} />
</div>
```

- [ ] **Step 7: Fix mobile layout of the sticky filter bar**

Find the sticky filter bar div (top of return). Replace the single `flex flex-wrap items-center justify-between gap-4` row with a two-row layout on mobile:

```tsx
<div className="sticky top-14 z-20 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-3 bg-background/85 backdrop-blur-md border-b border-border/50 space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
  {/* Row 1: program filter (full width on mobile) */}
  <ProgramFilterBar active={programFilter} onChange={setProgramFilter} />
  {/* Row 2: date + export (right-aligned, wraps below on mobile) */}
  <div className="flex items-center gap-3 sm:ml-auto">
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
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add src/components/dashboard/executive-dashboard.tsx
git commit -m "feat: real trend arrows + granularity toggle + mobile filter bar in ExecutiveDashboard"
```

---

## Task 8: Wire trends + granularity into MediaProgramDashboard

**Files:**
- Modify: `src/components/dashboard/media-program-dashboard.tsx`

- [ ] **Step 1: Add imports**

Add to the existing import block:

```typescript
import { usePreviousPeriodCounts } from "@/hooks/use-previous-period-counts";
import { GranularityToggle } from "./granularity-toggle";
import { groupByGranularity } from "./chart-builders";
import type { Granularity } from "./chart-builders";
```

- [ ] **Step 2: Add granularity state and trend hook inside the component**

After the existing `useState` declarations:

```typescript
const [granularity, setGranularity] = useState<Granularity>("month");

const trendInputs = useMemo(
  () => [{ key: "episodes", table: tableName, from, to }],
  [tableName, from, to]
);
const trends = usePreviousPeriodCounts(trendInputs);
```

- [ ] **Step 3: Switch monthlyGroups to use groupByGranularity**

Find:
```typescript
const monthlyGroups = useMemo(() => groupByMonth(entries, "date_aired"), [entries]);
```

Replace with:
```typescript
const monthlyGroups = useMemo(
  () => groupByGranularity(entries, "date_aired", granularity),
  [entries, granularity]
);
```

Remove `groupByMonth` from the import since it's now unused (replaced by `groupByGranularity`).

- [ ] **Step 4: Wire trend into the Episodes KPI card**

Find:
```tsx
<KpiCard label="Total Episodes" value={totalEpisodes} />
```

Replace with:
```tsx
<KpiCard label="Total Episodes" value={totalEpisodes} trend={trends["episodes"]} />
```

- [ ] **Step 5: Add GranularityToggle to the time-series section heading**

The time-series charts (Monthly Trend Analysis, Monthly Episodes, Views per Platform) are in the first `grid` after the KPI row. Wrap that grid with a section and add the toggle:

Before the first chart grid (`<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">`), add a section header:

```tsx
<section>
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-semibold text-gray-700">Trends Over Time</h2>
    <GranularityToggle value={granularity} onChange={setGranularity} />
  </div>
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    {/* existing chart cards unchanged */}
  </div>
</section>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/media-program-dashboard.tsx
git commit -m "feat: trend arrows + granularity toggle in MediaProgramDashboard"
```

---

## Task 9: Wire trends into EnterpriseSpotlightDashboard

**Files:**
- Modify: `src/components/dashboard/enterprise-spotlight-dashboard.tsx`

This dashboard has no time-series charts, so only trends apply. No granularity toggle needed.

- [ ] **Step 1: Add imports**

```typescript
import { usePreviousPeriodCounts } from "@/hooks/use-previous-period-counts";
```

Also add `useMemo` to the existing React import if not already present.

- [ ] **Step 2: Add trend hook inside the component**

After the existing `useState` declarations:

```typescript
const trendInputs = useMemo(
  () => [{ key: "applications", table: "enterprise_spotlight_entries", from, to }],
  [from, to]
);
const trends = usePreviousPeriodCounts(trendInputs);
```

- [ ] **Step 3: Wire trend into KPI cards**

Find:
```tsx
<KpiCard label="Total Applications" value={totalApplications} />
<KpiCard label="Regions Represented" value={uniqueRegions} />
```

Replace with:
```tsx
<KpiCard label="Total Applications" value={totalApplications} trend={trends["applications"]} />
<KpiCard label="Regions Represented" value={uniqueRegions} />
```

(Regions represented is a derived count, not a time-series count, so no trend needed for it.)

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/enterprise-spotlight-dashboard.tsx
git commit -m "feat: trend arrows in EnterpriseSpotlightDashboard"
```

---

## Task 10: Wire trends into AbsaOnboardingDashboard

**Files:**
- Modify: `src/components/dashboard/absa-onboarding-dashboard.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { usePreviousPeriodCounts } from "@/hooks/use-previous-period-counts";
import { useMemo } from "react"; // add if not already present
```

- [ ] **Step 2: Add trend hook inside the component**

After the existing `useState` declarations:

```typescript
const trendInputs = useMemo(
  () => [{ key: "participants", table: "absa_onboarding_entries", from, to }],
  [from, to]
);
const trends = usePreviousPeriodCounts(trendInputs);
```

- [ ] **Step 3: Wire trend into KPI card**

Find:
```tsx
<KpiCard label="Total Participants Onboarded" value={totalParticipants} />
```

Replace with:
```tsx
<KpiCard label="Total Participants Onboarded" value={totalParticipants} trend={trends["participants"]} />
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/absa-onboarding-dashboard.tsx
git commit -m "feat: trend arrows in AbsaOnboardingDashboard"
```

---

## Task 11: Final TypeScript + build verification

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: build succeeds with no errors (warnings OK)

- [ ] **Step 3: Start dev server and do visual smoke test**

```bash
npm run dev
```

Open http://localhost:3000 and verify:
- [ ] Executive Dashboard KPI cards show trend arrows ("+X% vs last month")
- [ ] Media Programs section has W/M/Q toggle; switching changes chart groupings
- [ ] On mobile width (≤640px): program filter shows as a Select dropdown
- [ ] Sidebar collapses to icon-only nav on desktop; tapping a nav item on mobile closes the sidebar
- [ ] Charts render at a visible height on mobile (≥224px)
- [ ] Individual program dashboards (VU, Hangout, ES, ABSA) show trend arrows on KPI cards
- [ ] VU and Hangout dashboards have W/M/Q toggle on the "Trends Over Time" section

- [ ] **Step 4: Final commit if any last-minute fixes were needed**

```bash
git add -p   # review and stage only intentional changes
git commit -m "fix: final smoke-test adjustments"
```
