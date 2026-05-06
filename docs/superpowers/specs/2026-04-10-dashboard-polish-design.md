# Dashboard Polish — Trend Arrows, Granularity Toggle, Mobile

**Date:** 2026-04-10
**Status:** Approved

## Overview

Three funder-facing improvements to all dashboards (Executive + all Program Dashboards):

1. Real trend arrows on KPI cards (always-on, default last-30-days baseline)
2. Weekly / Monthly / Quarterly granularity toggle on time-series charts
3. Comprehensive mobile responsiveness fixes

---

## 1. Trend Arrows on KPI Cards

### Behaviour

| State | Current Period | Previous Period | Label |
|-------|---------------|-----------------|-------|
| No date range set | Last 30 days | 31–60 days ago | "vs last month" |
| Date range set | Selected range | Equal-length window before range | "vs prior period" |

If either period has zero data, the trend is hidden (no misleading 0% arrow).

### Architecture

**New file:** `src/hooks/use-previous-period-counts.ts`

- Accepts `{ from: string; to: string; table: string }[]` — one entry per KPI being tracked
- Internally computes the default 30-day window when `from`/`to` are empty
- Fires two parallel `supabase.from(table).select("*", { count: "exact", head: true })` queries per table (current period + previous period) — no rows fetched, just counts
- Returns `Record<table, { value: number; label: string } | undefined>` — shaped exactly for the existing `KpiCard` `trend` prop
- Hook is called once per dashboard; results are passed down to each `KpiCard`

**No changes to `KpiCard`** — the `trend` prop already accepts `{ value: number; label: string }`.

### Dashboards affected

- `src/components/dashboard/executive-dashboard.tsx` — 4 KPI cards (ES applications, VU episodes, Hangout episodes, ABSA participants)
- `src/components/dashboard/enterprise-spotlight-dashboard.tsx`
- `src/components/dashboard/media-program-dashboard.tsx` (used by VU + Hangout)
- `src/components/dashboard/absa-onboarding-dashboard.tsx`

---

## 2. Chart Granularity Toggle

### UI

A compact `W / M / Q` segmented button group (3 small buttons) sits at the top-right of each dashboard *section heading row* that contains a time-series chart. Donut, pie, and horizontal bar charts are unaffected — no toggle appears beside them.

### Granularity Options

| Key | Label | Format example |
|-----|-------|---------------|
| `week` | W | "2025-W14" |
| `month` | M | "Apr 2025" (default) |
| `quarter` | Q | "Q1 2025" |

### Architecture

**Changes to `src/components/dashboard/chart-builders.ts`:**
- Add `groupByWeek(entries, dateField)` — uses ISO week number
- Add `groupByQuarter(entries, dateField)` — groups into Q1/Q2/Q3/Q4

**In each dashboard:**
- Add `const [granularity, setGranularity] = useState<"week" | "month" | "quarter">("month")`
- Single state shared across all time-series charts in that dashboard
- Pass granularity to a new `groupByGranularity(entries, dateField, granularity)` helper that delegates to the correct grouping function
- Toggle rendered as a `GranularityToggle` component: `src/components/dashboard/granularity-toggle.tsx`

### Dashboards / sections affected

- Executive Dashboard → Media Programs section (Monthly Views Trend, Monthly Episodes Aired)
- Enterprise Spotlight Dashboard → any "over time" chart
- MediaProgramDashboard (VU + Hangout) → episode/views over time
- ABSA Dashboard → any "over time" chart

---

## 3. Mobile Responsiveness

Six targeted fixes. No structural rewrites.

### Fix 1 — Sidebar closes on mobile nav tap

**File:** `src/components/layout/sidebar-nav-item.tsx`

Sidebar currently stays open after tapping a nav link on mobile. `SidebarNavItem` needs access to the collapse setter. The `Sidebar` component will pass an `onNavigate` callback down to each `SidebarNavItem`, which is called on `onClick`. On mobile (`window.innerWidth < 1024`) this triggers `setCollapsed(true)`.

### Fix 2 — Collapsed desktop sidebar shows icon nav

**File:** `src/components/layout/sidebar.tsx`

When collapsed on desktop, the sidebar currently shows a blank 64px strip. In collapsed state, render centred icons for each nav item with a Radix tooltip showing the label on hover.

### Fix 3 — Program filter bar → Select on mobile

**File:** `src/components/dashboard/program-filter-bar.tsx`

The tab-strip overflows on small screens. Render:
- `sm:hidden` — a `<Select>` dropdown (same value/onChange interface)
- `hidden sm:flex` — the existing tab buttons

### Fix 4 — Sticky Executive Dashboard filter bar wraps on mobile

**File:** `src/components/dashboard/executive-dashboard.tsx`

The sticky filter bar `flex-wrap` row with date range + export currently overflows horizontally on mobile. Change to:
- Row 1: `ProgramFilterBar` (full width)
- Row 2: Date range + Export button (wrapped, right-aligned)

### Fix 5 — Chart height responsive

**File:** `src/components/dashboard/echart.tsx`

ECharts charts can collapse to zero height on mobile. Add a `className` prop to `EChart` and set height via Tailwind: `h-56 lg:h-72` (224px mobile, 288px desktop). All chart card wrappers pass this class.

### Fix 6 — Data entry form field widths

**Files:** All form components in `src/components/data-entry/`

Any `w-*` fixed-width inputs become `w-full` on mobile. Grid form layouts use `grid-cols-1 sm:grid-cols-2`.

---

## Out of Scope

- PDF export (not in this iteration)
- Draft approval queue
- Notifications
- Dark mode

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/use-previous-period-counts.ts` | Trend data hook |
| `src/components/dashboard/granularity-toggle.tsx` | W/M/Q segmented control |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/dashboard/chart-builders.ts` | Add `groupByWeek`, `groupByQuarter`, `groupByGranularity` |
| `src/components/dashboard/echart.tsx` | Add `className` prop, responsive height |
| `src/components/dashboard/executive-dashboard.tsx` | Wire trends, granularity, mobile filter bar |
| `src/components/dashboard/enterprise-spotlight-dashboard.tsx` | Wire trends + granularity |
| `src/components/dashboard/media-program-dashboard.tsx` | Wire trends + granularity |
| `src/components/dashboard/absa-onboarding-dashboard.tsx` | Wire trends + granularity |
| `src/components/dashboard/program-filter-bar.tsx` | Mobile Select fallback |
| `src/components/layout/sidebar.tsx` | Collapsed icon nav + onNavigate callback |
| `src/components/layout/sidebar-nav-item.tsx` | Accept + call onNavigate on click |
| All `src/components/data-entry/*.tsx` forms | Responsive field widths |
