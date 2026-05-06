# Performance ED-Centered Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Performance module around the Executive Director's 10-second mobile glance. Replace `EdDashboard` with a new hero+list home, add a purpose-built ED drill-down (distinct from the Manager view), and surface Performance as a 5th filter option on the Executive Dashboard.

**Architecture:** Dark-themed, mobile-first surfaces composed of four shared primitives (hero tile, segmented status bar, department row card, quarter chip). Role-based dispatch in the two performance page files. The Performance filter view on the Executive Dashboard reuses the same composition as `/performance`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Supabase JS client, lucide-react icons. No test framework in this project — verification is via `npm run lint` + running the dev server and visually checking each screen.

**Spec:** [docs/superpowers/specs/2026-04-19-performance-ed-redesign-design.md](../specs/2026-04-19-performance-ed-redesign-design.md)

---

## File Structure

**Create:**
- `src/components/performance/performance-hero-tile.tsx` — shared hero tile (org % + trend delta + summary).
- `src/components/performance/status-segmented-bar.tsx` — shared 6px status bar with sub-labels.
- `src/components/performance/department-row-card.tsx` — new row-layout dept card replacing `department-card.tsx`.
- `src/components/performance/quarter-chip.tsx` — pill-shaped quarter selector for dark surfaces.
- `src/components/performance/ed-home.tsx` — new ED home composition (replaces `ed-dashboard.tsx`).
- `src/components/performance/ed-drilldown.tsx` — new read-only ED drill-down for a single department.
- `src/components/performance/goal-progress-card.tsx` — drill-down goal row.
- `src/components/performance/overdue-activity-row.tsx` — drill-down overdue row.
- `src/hooks/use-performance-ed-department.ts` — narrow hook for the drill-down (goals, overdue, last submission, manager name).

**Modify:**
- `src/hooks/use-performance-ed.ts` — add trend delta (prior quarter aggregate %) to returned state.
- `src/app/(dashboard)/performance/page.tsx` — render `<EdHome />` instead of `<EdDashboard />` for Admin.
- `src/app/(dashboard)/performance/[departmentId]/page.tsx` — role dispatch: Admin → `<EdDrilldown />`, manager → `<ManagerDashboard />`.
- `src/components/dashboard/program-filter-bar.tsx` — add `"performance"` to `ProgramFilter` union + filter options.
- `src/components/dashboard/executive-dashboard.tsx` — branch render when `programFilter === "performance"`.

**Delete (after redesign lands):**
- `src/components/performance/ed-dashboard.tsx` — fully replaced by `ed-home.tsx`.
- `src/components/performance/department-card.tsx` — replaced by `department-row-card.tsx`.
- `src/components/performance/alerts-panel.tsx` — no longer composed anywhere (Manager view already shows alerts inside its own tab which uses this component — confirm unused before deleting).

---

## Task 1: Extend `usePerformanceEd` with prior-quarter trend delta

**Files:**
- Modify: `src/hooks/use-performance-ed.ts`

- [ ] **Step 1: Add `trendDeltaPct` to hook state**

Open `src/hooks/use-performance-ed.ts`. Inside the `usePerformanceEd` function, add a new state alongside the existing ones:

```tsx
const [trendDeltaPct, setTrendDeltaPct] = useState<number | null>(null);
```

- [ ] **Step 2: Fetch prior-quarter aggregate in `load`**

After step 3 (staff counts) and before step 4 (assemble summaries), add a prior-quarter fetch. Compute prior year/quarter, fetch only enough to aggregate, then set the delta.

```tsx
// Prior quarter for trend delta
const priorQuarter = quarter === 1 ? 4 : quarter - 1;
const priorYear = quarter === 1 ? year - 1 : year;

const { data: priorGoals } = await supabase
  .from("performance_goals")
  .select(`
    activities:performance_activities (
      id,
      due_date,
      submission:activity_submissions ( id )
    )
  `)
  .eq("year", priorYear)
  .eq("quarter", priorQuarter);

const priorActivities = (priorGoals ?? []).flatMap(
  (g: { activities?: Array<{ submission: unknown }> }) => g.activities ?? []
);
const priorDone = priorActivities.filter((a) => {
  const sub = Array.isArray(a.submission) ? a.submission[0] : a.submission;
  return !!sub;
}).length;
const priorPct = priorActivities.length === 0
  ? null
  : Math.round((priorDone / priorActivities.length) * 100);
```

- [ ] **Step 3: Compute delta and set state after summaries are built**

At the very end of `load`, after `setDepartments(summaries)`:

```tsx
const totalAct = summaries.reduce(
  (s, d) => s + d.done_count + d.pending_count + d.overdue_count,
  0
);
const doneAct = summaries.reduce((s, d) => s + d.done_count, 0);
const currentPct = totalAct === 0 ? 0 : Math.round((doneAct / totalAct) * 100);
setTrendDeltaPct(priorPct === null ? null : currentPct - priorPct);
```

- [ ] **Step 4: Expose `trendDeltaPct` from the return**

Change the return to:

```tsx
return { departments, trendDeltaPct, loading, error, reload: load };
```

- [ ] **Step 5: Verify typecheck + lint passes**

Run: `npm run lint`
Expected: no errors on the modified file.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-performance-ed.ts
git commit -m "feat(performance): add prior-quarter trend delta to ed hook"
```

---

## Task 2: Create `PerformanceHeroTile` primitive

**Files:**
- Create: `src/components/performance/performance-hero-tile.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

interface PerformanceHeroTileProps {
  pct: number;
  onTrackCount: number;
  totalDepts: number;
  doneActivities: number;
  totalActivities: number;
  trendDeltaPct: number | null;
  status: "on_track" | "at_risk" | "behind";
}

const GRADIENTS: Record<PerformanceHeroTileProps["status"], string> = {
  on_track:
    "bg-[linear-gradient(135deg,#14532D_0%,#166534_60%,#1A2030_100%)]",
  at_risk:
    "bg-[linear-gradient(135deg,#422006_0%,#78350F_60%,#1A2030_100%)]",
  behind:
    "bg-[linear-gradient(135deg,#450A0A_0%,#7F1D1D_60%,#1A2030_100%)]",
};

const ACCENT: Record<PerformanceHeroTileProps["status"], string> = {
  on_track: "text-[#86EFAC]",
  at_risk: "text-[#FCD34D]",
  behind: "text-[#FCA5A5]",
};

export function PerformanceHeroTile({
  pct,
  onTrackCount,
  totalDepts,
  doneActivities,
  totalActivities,
  trendDeltaPct,
  status,
}: PerformanceHeroTileProps) {
  const trendText =
    trendDeltaPct === null
      ? null
      : `${trendDeltaPct >= 0 ? "▲" : "▼"} ${Math.abs(trendDeltaPct)}% vs last quarter`;

  return (
    <div className={`rounded-3xl p-5 text-white ${GRADIENTS[status]}`}>
      <div className={`text-[11px] font-bold tracking-[2px] ${ACCENT[status]}`}>
        ORG HEALTH
      </div>
      <div className="mt-2 flex items-end gap-3">
        <div className="text-[64px] font-extrabold leading-none tracking-tight">
          {pct}
          <span className={`text-[28px] ${ACCENT[status]}`}>%</span>
        </div>
        {trendText && (
          <div className={`pb-2 text-xs ${ACCENT[status]}`}>{trendText}</div>
        )}
      </div>
      <div className="mt-3 text-[13px] text-white/80">
        {onTrackCount} of {totalDepts} departments on track · {doneActivities} of{" "}
        {totalActivities} activities done this quarter
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`

- [ ] **Step 3: Commit**

```bash
git add src/components/performance/performance-hero-tile.tsx
git commit -m "feat(performance): add PerformanceHeroTile primitive"
```

---

## Task 3: Create `StatusSegmentedBar` primitive

**Files:**
- Create: `src/components/performance/status-segmented-bar.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

interface StatusSegmentedBarProps {
  onTrack: number;
  atRisk: number;
  behind: number;
  showLabels?: boolean;
}

export function StatusSegmentedBar({
  onTrack,
  atRisk,
  behind,
  showLabels = true,
}: StatusSegmentedBarProps) {
  const total = onTrack + atRisk + behind;
  const safeTotal = total === 0 ? 1 : total;

  return (
    <div>
      <div className="flex gap-[3px] h-1.5 rounded-full overflow-hidden bg-[#1A2030]">
        {onTrack > 0 && (
          <div style={{ flex: onTrack / safeTotal }} className="bg-[#22C55E]" />
        )}
        {atRisk > 0 && (
          <div style={{ flex: atRisk / safeTotal }} className="bg-[#F59E0B]" />
        )}
        {behind > 0 && (
          <div style={{ flex: behind / safeTotal }} className="bg-[#DC2626]" />
        )}
      </div>
      {showLabels && (
        <div className="mt-1.5 flex justify-between text-[10px] tracking-wider text-[#8891A6]">
          <span>{onTrack} ON TRACK</span>
          <span>{atRisk} AT RISK</span>
          <span>{behind} BEHIND</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint + commit**

```bash
npm run lint
git add src/components/performance/status-segmented-bar.tsx
git commit -m "feat(performance): add StatusSegmentedBar primitive"
```

---

## Task 4: Create `DepartmentRowCard` primitive

**Files:**
- Create: `src/components/performance/department-row-card.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useRouter } from "next/navigation";
import type { DepartmentSummary } from "@/lib/types";

interface DepartmentRowCardProps {
  dept: DepartmentSummary;
}

function monogram(name: string): string {
  const words = name.replace(/&/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const STATUS_STYLE = {
  on_track: {
    surface: "bg-[#151B27]",
    border: "",
    badgeBg: "bg-[#052E16]",
    badgeText: "text-[#4ADE80]",
    valueText: "text-[#4ADE80]",
    subText: "text-[#8891A6]",
    pillText: "text-[#4ADE80]",
    pillLabel: "ON TRACK",
  },
  at_risk: {
    surface:
      "bg-[linear-gradient(135deg,#1F1405_0%,#151B27_80%)] border border-[#F59E0B33]",
    border: "",
    badgeBg: "bg-[#451A03]",
    badgeText: "text-[#FBBF24]",
    valueText: "text-[#FBBF24]",
    subText: "text-[#FBBF24]",
    pillText: "text-[#FBBF24]",
    pillLabel: "AT RISK",
  },
  behind: {
    surface:
      "bg-[linear-gradient(135deg,#1F0505_0%,#151B27_80%)] border border-[#DC262633]",
    border: "",
    badgeBg: "bg-[#450A0A]",
    badgeText: "text-[#FCA5A5]",
    valueText: "text-[#FCA5A5]",
    subText: "text-[#FCA5A5]",
    pillText: "text-[#FCA5A5]",
    pillLabel: "BEHIND",
  },
} as const;

export function DepartmentRowCard({ dept }: DepartmentRowCardProps) {
  const router = useRouter();
  const s = STATUS_STYLE[dept.status];
  const total = dept.done_count + dept.pending_count + dept.overdue_count;
  const subLine =
    dept.overdue_count > 0
      ? `${dept.done_count}/${total} done · ${dept.overdue_count} overdue`
      : `${dept.done_count} of ${total} activities complete`;

  return (
    <button
      type="button"
      onClick={() => router.push(`/performance/${dept.id}`)}
      className={`w-full text-left rounded-2xl p-4 flex items-center gap-3.5 transition-transform active:scale-[0.99] ${s.surface}`}
    >
      <div
        className={`size-11 rounded-2xl flex items-center justify-center font-extrabold text-[15px] ${s.badgeBg} ${s.badgeText}`}
      >
        {monogram(dept.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-white truncate">
          {dept.name}
        </div>
        <div className={`text-[11px] mt-0.5 ${s.subText}`}>{subLine}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-[20px] font-extrabold tracking-tight ${s.valueText}`}>
          {dept.progress_pct}%
        </div>
        <div
          className={`text-[9px] tracking-[1px] font-bold ${s.pillText}`}
        >
          {s.pillLabel}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Lint + commit**

```bash
npm run lint
git add src/components/performance/department-row-card.tsx
git commit -m "feat(performance): add DepartmentRowCard primitive"
```

---

## Task 5: Create `QuarterChip` selector

**Files:**
- Create: `src/components/performance/quarter-chip.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface QuarterChipProps {
  year: number;
  quarter: number;
  onYearChange: (y: number) => void;
  onQuarterChange: (q: number) => void;
}

export function QuarterChip({
  year,
  quarter,
  onYearChange,
  onQuarterChange,
}: QuarterChipProps) {
  const [open, setOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#1A2030] px-3.5 py-2 text-[11px] font-semibold text-white"
      >
        Q{quarter} · {year}
        <ChevronDown className="size-3" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 z-10 rounded-xl bg-[#151B27] p-2 shadow-xl border border-white/10 min-w-[160px]">
          <div className="flex gap-1 p-1">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => onYearChange(y)}
                className={`flex-1 rounded-md px-2 py-1 text-[11px] ${
                  y === year ? "bg-white/10 text-white" : "text-[#8891A6]"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="flex gap-1 p-1">
            {[1, 2, 3, 4].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  onQuarterChange(q);
                  setOpen(false);
                }}
                className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold ${
                  q === quarter
                    ? "bg-[#5BBF3A] text-white"
                    : "text-[#8891A6] hover:text-white"
                }`}
              >
                Q{q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint + commit**

```bash
npm run lint
git add src/components/performance/quarter-chip.tsx
git commit -m "feat(performance): add QuarterChip dark selector"
```

---

## Task 6: Create `EdHome` composition

**Files:**
- Create: `src/components/performance/ed-home.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { PerformanceHeroTile } from "./performance-hero-tile";
import { StatusSegmentedBar } from "./status-segmented-bar";
import { DepartmentRowCard } from "./department-row-card";
import { QuarterChip } from "./quarter-chip";
import { usePerformanceEd } from "@/hooks/use-performance-ed";

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function EdHome() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  const { departments, trendDeltaPct, loading, error } = usePerformanceEd(
    year,
    quarter
  );

  if (error) {
    return (
      <div className="rounded-2xl bg-red-900/40 border border-red-700 p-5 text-sm text-red-100">
        Failed to load performance data: {error}
      </div>
    );
  }

  const onTrack = departments.filter((d) => d.status === "on_track").length;
  const atRisk = departments.filter((d) => d.status === "at_risk").length;
  const behind = departments.filter((d) => d.status === "behind").length;

  const totalActivities = departments.reduce(
    (s, d) => s + d.done_count + d.pending_count + d.overdue_count,
    0
  );
  const doneActivities = departments.reduce((s, d) => s + d.done_count, 0);
  const pct =
    totalActivities === 0
      ? 0
      : Math.round((doneActivities / totalActivities) * 100);

  const overallStatus: "on_track" | "at_risk" | "behind" =
    behind > 0 ? "behind" : atRisk > 0 ? "at_risk" : "on_track";

  return (
    <div className="space-y-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[#8891A6]">{formatDate(now)}</div>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">
            Performance
          </h1>
        </div>
        <QuarterChip
          year={year}
          quarter={quarter}
          onYearChange={setYear}
          onQuarterChange={setQuarter}
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-40 rounded-3xl bg-[#151B27] animate-pulse" />
          <div className="h-6 rounded-full bg-[#151B27] animate-pulse" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] rounded-2xl bg-[#151B27] animate-pulse"
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <PerformanceHeroTile
            pct={pct}
            onTrackCount={onTrack}
            totalDepts={departments.length}
            doneActivities={doneActivities}
            totalActivities={totalActivities}
            trendDeltaPct={trendDeltaPct}
            status={overallStatus}
          />

          <StatusSegmentedBar
            onTrack={onTrack}
            atRisk={atRisk}
            behind={behind}
          />

          <div className="space-y-2.5">
            {departments.map((dept) => (
              <DepartmentRowCard key={dept.id} dept={dept} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint + commit**

```bash
npm run lint
git add src/components/performance/ed-home.tsx
git commit -m "feat(performance): add EdHome composition"
```

---

## Task 7: Wire `EdHome` into `/performance` page

**Files:**
- Modify: `src/app/(dashboard)/performance/page.tsx`

- [ ] **Step 1: Replace `EdDashboard` import + render**

Open `src/app/(dashboard)/performance/page.tsx`. Change:

```tsx
import { EdDashboard } from "@/components/performance/ed-dashboard";
```

to:

```tsx
import { EdHome } from "@/components/performance/ed-home";
```

And change the final return:

```tsx
return <EdHome />;
```

- [ ] **Step 2: Wrap page in dark surface**

The new surface is dark. Wrap `<EdHome />` in a dark background so it renders correctly against the app shell. Update the `return` block for both the skeleton and the main return to wrap in:

```tsx
<div className="-mx-4 -my-4 sm:-mx-6 sm:-my-6 min-h-screen bg-[#0B0F17] px-4 py-5 sm:px-6 sm:py-6">
  <div className="mx-auto max-w-[560px]">
    {/* existing skeleton or <EdHome /> */}
  </div>
</div>
```

If the app shell already sets a layout padding that makes negative margins brittle, drop the negative margins and just use `bg-[#0B0F17]` on the wrapper — visual parity with the mockup is what matters, not bleeding to the edges.

- [ ] **Step 3: Manually verify in dev server**

Run: `npm run dev`
Open `/performance` as an Admin. Expected:
- Dark background.
- Header says "Performance" with today's date above it.
- Hero tile shows the overall org %.
- Segmented bar + 5 department row cards visible.
- Quarter chip in top-right opens a picker when tapped.

Take a screenshot via the preview tools if verifying unattended.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/performance/page.tsx
git commit -m "feat(performance): switch /performance to EdHome"
```

---

## Task 8: Create `use-performance-ed-department` hook

**Files:**
- Create: `src/hooks/use-performance-ed-department.ts`

- [ ] **Step 1: Write the hook**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  computeActivityStatus,
  computeGoalStatus,
  getExpectedProgress,
} from "@/lib/performance-utils";
import type {
  Department,
  GoalWithActivities,
  ActivityWithStatus,
  PerformanceGoal,
  PerformanceActivity,
  ActivitySubmission,
  ActivityAttachment,
} from "@/lib/types";

export interface EdDepartmentView {
  department: Department;
  managerName: string | null;
  goals: GoalWithActivities[];
  overdue: ActivityWithStatus[];
  lastSubmission: {
    activityTitle: string;
    submittedByName: string;
    submittedAt: string;
  } | null;
  status: "on_track" | "at_risk" | "behind";
  progressPct: number;
  doneCount: number;
  pendingCount: number;
  overdueCount: number;
}

export function usePerformanceEdDepartment(
  departmentId: string,
  year: number,
  quarter: number
) {
  const [view, setView] = useState<EdDepartmentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: dept, error: deptErr } = await supabase
      .from("departments")
      .select("*")
      .eq("id", departmentId)
      .single();

    if (deptErr || !dept) {
      setError(deptErr?.message ?? "Department not found");
      setLoading(false);
      return;
    }

    const { data: managerRow } = await supabase
      .from("user_departments")
      .select("user:user_profiles!user_id ( full_name )")
      .eq("department_id", departmentId)
      .eq("is_manager", true)
      .maybeSingle();

    const managerName =
      (managerRow as { user?: { full_name?: string } } | null)?.user
        ?.full_name ?? null;

    const { data: goals, error: goalsErr } = await supabase
      .from("performance_goals")
      .select(`
        *,
        activities:performance_activities (
          *,
          assignee:user_profiles!assigned_to ( full_name ),
          submission:activity_submissions (
            *,
            attachments:activity_attachments ( * ),
            submittedBy:user_profiles!submitted_by ( full_name )
          )
        )
      `)
      .eq("department_id", departmentId)
      .eq("year", year)
      .eq("quarter", quarter);

    if (goalsErr) {
      setError(goalsErr.message);
      setLoading(false);
      return;
    }

    const expectedPct = getExpectedProgress(quarter, year);

    type RawSub = ActivitySubmission & {
      attachments: ActivityAttachment[];
      submittedBy?: { full_name?: string };
    };
    type RawAct = PerformanceActivity & {
      assignee: { full_name: string };
      submission: RawSub | RawSub[] | null;
    };

    const enrichedGoals: GoalWithActivities[] = (goals ?? []).map(
      (g: PerformanceGoal & { activities?: RawAct[] }) => {
        const activities: ActivityWithStatus[] = (g.activities ?? []).map(
          (act) => {
            const rawSub = act.submission;
            const sub = Array.isArray(rawSub) ? rawSub[0] ?? null : rawSub;
            return {
              ...act,
              status: computeActivityStatus(
                act,
                sub
                  ? {
                      id: sub.id,
                      activity_id: sub.activity_id,
                      submitted_by: sub.submitted_by,
                      description: sub.description,
                      submitted_at: sub.submitted_at,
                      updated_at: sub.updated_at,
                    }
                  : null
              ),
              submission: sub
                ? {
                    id: sub.id,
                    activity_id: sub.activity_id,
                    submitted_by: sub.submitted_by,
                    description: sub.description,
                    submitted_at: sub.submitted_at,
                    updated_at: sub.updated_at,
                  }
                : null,
              attachments: sub?.attachments ?? [],
              assignee: act.assignee ?? { full_name: "Unknown", email: "" },
            };
          }
        );

        const done = activities.filter((a) => a.status === "done").length;
        const total = activities.length;
        const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);
        const hasOverdue = activities.some((a) => a.status === "overdue");

        return {
          id: g.id,
          department_id: g.department_id,
          title: g.title,
          description: g.description ?? null,
          year: g.year,
          quarter: g.quarter,
          due_date: g.due_date,
          created_by: g.created_by ?? null,
          created_at: g.created_at,
          activities,
          progress_pct: progressPct,
          status: computeGoalStatus(progressPct, expectedPct, hasOverdue),
        };
      }
    );

    const allActivities = enrichedGoals.flatMap((g) => g.activities);
    const done = allActivities.filter((a) => a.status === "done").length;
    const pending = allActivities.filter((a) => a.status === "pending").length;
    const overdueList = allActivities
      .filter((a) => a.status === "overdue")
      .sort(
        (a, b) =>
          new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      );
    const total = allActivities.length;
    const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);

    // Find the most recent submission across the department
    const submitted = (goals ?? [])
      .flatMap((g: { activities?: RawAct[] }) =>
        (g.activities ?? []).flatMap((a) => {
          const rawSub = a.submission;
          const sub = Array.isArray(rawSub) ? rawSub[0] ?? null : rawSub;
          if (!sub) return [];
          return [
            {
              activityTitle: a.title,
              submittedByName: sub.submittedBy?.full_name ?? "Unknown",
              submittedAt: sub.submitted_at,
            },
          ];
        })
      )
      .sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() -
          new Date(a.submittedAt).getTime()
      );
    const lastSubmission = submitted.length > 0 ? submitted[0] : null;

    setView({
      department: dept as Department,
      managerName,
      goals: enrichedGoals,
      overdue: overdueList,
      lastSubmission,
      status: computeGoalStatus(progressPct, expectedPct, overdueList.length > 0),
      progressPct,
      doneCount: done,
      pendingCount: pending,
      overdueCount: overdueList.length,
    });
    setLoading(false);
  }, [departmentId, year, quarter]);

  useEffect(() => {
    load();
  }, [load]);

  return { view, loading, error, reload: load };
}
```

- [ ] **Step 2: Lint + commit**

```bash
npm run lint
git add src/hooks/use-performance-ed-department.ts
git commit -m "feat(performance): add use-performance-ed-department hook"
```

---

## Task 9: Create `GoalProgressCard` primitive

**Files:**
- Create: `src/components/performance/goal-progress-card.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import type { GoalWithActivities } from "@/lib/types";

interface GoalProgressCardProps {
  goal: GoalWithActivities;
}

const ACCENT: Record<GoalWithActivities["status"], string> = {
  on_track: "text-[#4ADE80] bg-[#22C55E]",
  at_risk: "text-[#FBBF24] bg-[#F59E0B]",
  behind: "text-[#FCA5A5] bg-[#DC2626]",
};

export function GoalProgressCard({ goal }: GoalProgressCardProps) {
  const [textClass, barClass] = ACCENT[goal.status].split(" ");
  const borderClass =
    goal.status === "on_track"
      ? ""
      : goal.status === "at_risk"
      ? "border border-[#F59E0B33]"
      : "border border-[#DC262633]";

  return (
    <div className={`rounded-2xl bg-[#151B27] p-3.5 ${borderClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-white truncate">
          {goal.title}
        </div>
        <div className={`text-xs font-bold ${textClass}`}>
          {goal.progress_pct}%
        </div>
      </div>
      <div className="mt-2 h-1 rounded-full bg-[#0B0F17] overflow-hidden">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${goal.progress_pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint + commit**

```bash
npm run lint
git add src/components/performance/goal-progress-card.tsx
git commit -m "feat(performance): add GoalProgressCard primitive"
```

---

## Task 10: Create `OverdueActivityRow` primitive

**Files:**
- Create: `src/components/performance/overdue-activity-row.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import type { ActivityWithStatus } from "@/lib/types";

interface OverdueActivityRowProps {
  activity: ActivityWithStatus;
}

function daysLate(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  return Math.max(1, Math.floor((now.getTime() - due.getTime()) / 86400000));
}

export function OverdueActivityRow({ activity }: OverdueActivityRowProps) {
  const late = daysLate(activity.due_date);
  return (
    <div className="rounded-2xl bg-[#151B27] p-3.5 border-l-[3px] border-[#DC2626]">
      <div className="text-[13px] font-semibold text-white">{activity.title}</div>
      <div className="mt-1.5 flex justify-between text-[11px]">
        <span className="text-[#8891A6]">{activity.assignee.full_name}</span>
        <span className="text-[#FCA5A5]">
          {late} day{late === 1 ? "" : "s"} late
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint + commit**

```bash
npm run lint
git add src/components/performance/overdue-activity-row.tsx
git commit -m "feat(performance): add OverdueActivityRow primitive"
```

---

## Task 11: Create `EdDrilldown` composition

**Files:**
- Create: `src/components/performance/ed-drilldown.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StatusSegmentedBar } from "./status-segmented-bar";
import { GoalProgressCard } from "./goal-progress-card";
import { OverdueActivityRow } from "./overdue-activity-row";
import { usePerformanceEdDepartment } from "@/hooks/use-performance-ed-department";

interface EdDrilldownProps {
  departmentId: string;
}

const STATUS_META = {
  on_track: {
    label: "ON TRACK",
    accent: "text-[#4ADE80]",
    gradient: "bg-[linear-gradient(135deg,#14532D_0%,#151B27_100%)]",
    border: "border border-[#22C55E33]",
  },
  at_risk: {
    label: "AT RISK",
    accent: "text-[#FBBF24]",
    gradient: "bg-[linear-gradient(135deg,#1F1405_0%,#151B27_100%)]",
    border: "border border-[#F59E0B33]",
  },
  behind: {
    label: "BEHIND",
    accent: "text-[#FCA5A5]",
    gradient: "bg-[linear-gradient(135deg,#1F0505_0%,#151B27_100%)]",
    border: "border border-[#DC262633]",
  },
} as const;

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

export function EdDrilldown({ departmentId }: EdDrilldownProps) {
  const router = useRouter();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [quarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  const { view, loading, error } = usePerformanceEdDepartment(
    departmentId,
    year,
    quarter
  );

  if (error) {
    return (
      <div className="rounded-2xl bg-red-900/40 border border-red-700 p-5 text-sm text-red-100">
        {error}
      </div>
    );
  }

  if (loading || !view) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 rounded-xl bg-[#151B27] animate-pulse" />
        <div className="h-40 rounded-3xl bg-[#151B27] animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] rounded-2xl bg-[#151B27] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const meta = STATUS_META[view.status];

  return (
    <div className="space-y-5 text-white">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="size-9 rounded-xl bg-[#1A2030] flex items-center justify-center text-[#8891A6] hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-[#8891A6]">
            Q{quarter} · {year}
          </div>
          <h1 className="text-xl font-bold tracking-tight truncate">
            {view.department.name}
          </h1>
        </div>
      </div>

      <div className={`rounded-3xl p-5 ${meta.gradient} ${meta.border}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className={`text-[10px] tracking-[2px] font-bold ${meta.accent}`}>
              {meta.label}
            </div>
            <div className="mt-1.5 text-5xl font-extrabold tracking-tight">
              {view.progressPct}
              <span className={`text-[22px] ${meta.accent}`}>%</span>
            </div>
            <div className="mt-1 text-[12px] text-white/80">
              {view.doneCount} of{" "}
              {view.doneCount + view.pendingCount + view.overdueCount} activities
              done
            </div>
          </div>
          {view.managerName && (
            <div className="text-right">
              <div className="text-[11px] text-[#8891A6]">Led by</div>
              <div className="text-[13px] font-semibold mt-0.5">
                {view.managerName}
              </div>
            </div>
          )}
        </div>
        <div className="mt-4">
          <StatusSegmentedBar
            onTrack={view.doneCount}
            atRisk={view.pendingCount}
            behind={view.overdueCount}
            showLabels={false}
          />
          <div className="mt-1.5 flex justify-between text-[10px] tracking-wider text-[#8891A6]">
            <span>{view.doneCount} DONE</span>
            <span>{view.pendingCount} PENDING</span>
            <span>{view.overdueCount} OVERDUE</span>
          </div>
        </div>
      </div>

      {view.goals.length > 0 && (
        <div>
          <div className="text-[10px] tracking-[2px] font-bold text-[#8891A6]">
            GOALS · Q{quarter}
          </div>
          <div className="mt-3 space-y-2">
            {view.goals.map((goal) => (
              <GoalProgressCard key={goal.id} goal={goal} />
            ))}
          </div>
        </div>
      )}

      {view.overdue.length > 0 && (
        <div>
          <div className="text-[10px] tracking-[2px] font-bold text-[#FCA5A5]">
            OVERDUE · {view.overdue.length} ITEM
            {view.overdue.length === 1 ? "" : "S"}
          </div>
          <div className="mt-3 space-y-2">
            {view.overdue.map((a) => (
              <OverdueActivityRow key={a.id} activity={a} />
            ))}
          </div>
        </div>
      )}

      {view.lastSubmission && (
        <div>
          <div className="text-[10px] tracking-[2px] font-bold text-[#8891A6]">
            LAST SUBMISSION
          </div>
          <div className="mt-3 rounded-2xl bg-[#151B27] p-3.5">
            <div className="text-[13px] font-semibold">
              {view.lastSubmission.activityTitle}
            </div>
            <div className="mt-1 text-[11px] text-[#8891A6]">
              {view.lastSubmission.submittedByName} ·{" "}
              {timeAgo(view.lastSubmission.submittedAt)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint + commit**

```bash
npm run lint
git add src/components/performance/ed-drilldown.tsx
git commit -m "feat(performance): add EdDrilldown composition"
```

---

## Task 12: Role-dispatch in `/performance/[departmentId]/page.tsx`

**Files:**
- Modify: `src/app/(dashboard)/performance/[departmentId]/page.tsx`

- [ ] **Step 1: Replace the page with a role-dispatching client wrapper**

The current page is a server component that delegates to `ManagerDashboard`. We need a client wrapper that reads the user role and routes to either `EdDrilldown` or `ManagerDashboard`. Replace the file's content with:

```tsx
"use client";

import { use } from "react";
import { useUser } from "@/hooks/use-user";
import { EdDrilldown } from "@/components/performance/ed-drilldown";
import { ManagerDashboard } from "@/components/performance/manager-dashboard";

interface Props {
  params: Promise<{ departmentId: string }>;
}

export default function DepartmentPerformancePage({ params }: Props) {
  const { departmentId } = use(params);
  const { user, loading } = useUser();

  if (loading || !user) {
    return (
      <div className="space-y-3">
        <div className="h-10 rounded-xl bg-muted animate-pulse" />
        <div className="h-40 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (user.role?.name === "Admin") {
    return (
      <div className="-mx-4 -my-4 sm:-mx-6 sm:-my-6 min-h-screen bg-[#0B0F17] px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-[560px]">
          <EdDrilldown departmentId={departmentId} />
        </div>
      </div>
    );
  }

  return <ManagerDashboard departmentId={departmentId} />;
}
```

If the app shell's negative-margin trick (`-mx-4 -my-4 ...`) doesn't cleanly bleed to the edges because of unknown parent padding, drop the negative margins and just apply `bg-[#0B0F17]` with normal padding — the dark surface must cover behind the ED drill-down, but edge-to-edge bleed is cosmetic.

- [ ] **Step 2: Manually verify**

Run `npm run dev`.

1. As Admin, navigate `/performance` → tap any department. Expected: ED drill-down renders, with back arrow returning to `/performance`.
2. As a department manager, navigate to `/performance/<your-department-id>`. Expected: `ManagerDashboard` still renders as before.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/performance/[departmentId]/page.tsx"
git commit -m "feat(performance): role-dispatch ED drill-down vs Manager view"
```

---

## Task 13: Add `"performance"` option to `ProgramFilterBar`

**Files:**
- Modify: `src/components/dashboard/program-filter-bar.tsx`

- [ ] **Step 1: Extend the union and options**

Change `ProgramFilter` and `FILTER_OPTIONS`:

```tsx
export type ProgramFilter =
  | "enterprise-spotlight"
  | "virtual-university"
  | "hangout"
  | "absa-onboarding"
  | "performance";

const FILTER_OPTIONS: { value: ProgramFilter; label: string }[] = [
  { value: "enterprise-spotlight", label: "Enterprise Spotlight" },
  { value: "virtual-university", label: "Virtual University" },
  { value: "hangout", label: "Hangout" },
  { value: "absa-onboarding", label: "ABSA Onboarding" },
  { value: "performance", label: "Performance" },
];
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: may surface type errors in `executive-dashboard.tsx` because the new value is not yet handled. That's fine — the next task fixes it.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/program-filter-bar.tsx
git commit -m "feat(dashboard): add Performance option to program filter bar"
```

---

## Task 14: Branch `ExecutiveDashboard` to render Performance view

**Files:**
- Modify: `src/components/dashboard/executive-dashboard.tsx`

- [ ] **Step 1: Add a helper that renders the Performance panel**

At the top of `ExecutiveDashboard`'s JSX return, add a branch *before* the existing program rendering logic so that when `programFilter === "performance"` we render a compact version of the ED home composition and skip the rest.

Import the shared primitives at the top of the file:

```tsx
import { PerformanceHeroTile } from "@/components/performance/performance-hero-tile";
import { StatusSegmentedBar } from "@/components/performance/status-segmented-bar";
import { DepartmentRowCard } from "@/components/performance/department-row-card";
import { usePerformanceEd } from "@/hooks/use-performance-ed";
```

- [ ] **Step 2: Compute current year/quarter near the top of the component body**

Add after the existing `useState` block:

```tsx
const perfYear = new Date().getFullYear();
const perfQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
const performanceView = usePerformanceEd(perfYear, perfQuarter);
```

Note: this hook runs on every render of the dashboard regardless of which filter is active. The Supabase client caches; cost is minor. If profiling shows it's expensive, guard it behind `programFilter === "performance"` via a conditional hook wrapper — but do not introduce that complexity pre-emptively.

- [ ] **Step 3: Add the render branch**

At the start of the return JSX, wrap the existing content so that when performance is active, the dashboard swaps entirely. Pseudo:

```tsx
if (programFilter === "performance") {
  const { departments, trendDeltaPct, loading: perfLoading, error: perfError } =
    performanceView;

  const onTrack = departments.filter((d) => d.status === "on_track").length;
  const atRisk = departments.filter((d) => d.status === "at_risk").length;
  const behind = departments.filter((d) => d.status === "behind").length;
  const totalActivities = departments.reduce(
    (s, d) => s + d.done_count + d.pending_count + d.overdue_count,
    0
  );
  const doneActivities = departments.reduce((s, d) => s + d.done_count, 0);
  const pct = totalActivities === 0
    ? 0
    : Math.round((doneActivities / totalActivities) * 100);
  const overallStatus: "on_track" | "at_risk" | "behind" =
    behind > 0 ? "behind" : atRisk > 0 ? "at_risk" : "on_track";

  return (
    <div className="-mx-4 -my-4 sm:-mx-6 sm:-my-6 min-h-screen bg-[#0B0F17] px-4 py-5 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-[560px] space-y-5 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Department Performance</h1>
          <ProgramFilterBar active={programFilter} onChange={setProgramFilter} />
        </div>

        {perfError && (
          <div className="rounded-2xl bg-red-900/40 border border-red-700 p-5 text-sm text-red-100">
            {perfError}
          </div>
        )}

        {perfLoading ? (
          <div className="space-y-4">
            <div className="h-40 rounded-3xl bg-[#151B27] animate-pulse" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[72px] rounded-2xl bg-[#151B27] animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <PerformanceHeroTile
              pct={pct}
              onTrackCount={onTrack}
              totalDepts={departments.length}
              doneActivities={doneActivities}
              totalActivities={totalActivities}
              trendDeltaPct={trendDeltaPct}
              status={overallStatus}
            />
            <StatusSegmentedBar onTrack={onTrack} atRisk={atRisk} behind={behind} />
            <div className="space-y-2.5">
              {departments.map((dept) => (
                <DepartmentRowCard key={dept.id} dept={dept} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

Place this `if` branch immediately before the existing `return` in `ExecutiveDashboard`. The rest of the component's logic is untouched.

- [ ] **Step 4: Hide `DateRangeFilter` + `ExportButton` when Performance is active**

Since the Performance branch takes over the whole return, those controls are naturally omitted — no further change needed for them. Confirm by reading the existing return above your new branch to make sure the Performance branch exits cleanly.

- [ ] **Step 5: Manually verify**

Run `npm run dev`.

1. Open the Executive Dashboard.
2. Expected: filter strip now has a "Performance" tab (desktop) or option (mobile).
3. Select "Performance". Expected: dashboard swaps to dark surface with hero tile, segmented bar, 5 dept cards.
4. Switch back to "Enterprise Spotlight". Expected: original program dashboard renders normally.
5. Tap a department card from Performance view. Expected: navigate to `/performance/<id>` (ED drill-down for Admin).

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/executive-dashboard.tsx
git commit -m "feat(dashboard): add Performance view to Executive Dashboard filter"
```

---

## Task 15: Delete deprecated components

**Files:**
- Delete: `src/components/performance/ed-dashboard.tsx`
- Delete: `src/components/performance/department-card.tsx`

- [ ] **Step 1: Verify nothing imports them**

Run:

```bash
grep -r "ed-dashboard\|EdDashboard\|department-card\|DepartmentCard" src/
```

Expected: no hits outside the files slated for deletion. (Note: the Manager view uses `alerts-panel.tsx` for its Alerts tab — leave `alerts-panel.tsx` alone.)

If `DepartmentCard` is referenced anywhere else, stop and report — the plan assumed it was only used by `EdDashboard`.

- [ ] **Step 2: Delete**

```bash
rm src/components/performance/ed-dashboard.tsx
rm src/components/performance/department-card.tsx
```

- [ ] **Step 3: Lint + commit**

```bash
npm run lint
git add -A src/components/performance/
git commit -m "chore(performance): remove deprecated ed-dashboard and department-card"
```

---

## Task 16: Final verification pass

- [ ] **Step 1: Lint whole repo**

Run: `npm run lint`
Expected: zero errors.

- [ ] **Step 2: Walk all user flows in dev**

Run: `npm run dev`. Log in as Admin and verify:

1. `/performance` → dark ED home renders, quarter chip works, status bar + 5 dept rows visible.
2. Tap any dept → ED drill-down renders with hero, goals, overdue list (if any), last submission.
3. Back arrow → returns to `/performance`.
4. Executive Dashboard → "Performance" filter tab visible and switches the body to the dark Performance view.
5. From that view, tap a dept → ED drill-down.

Log in as a department manager and verify:

1. `/performance` → still redirects to `/performance/<their-dept-id>` (existing behavior in `/performance/page.tsx`).
2. `/performance/<their-dept-id>` → still renders `ManagerDashboard`, not the ED drill-down.

Log in as a staff user and verify:

1. `/performance` → still redirects to `/performance/me`.
2. `/performance/me` → still renders `StaffDashboard`.

- [ ] **Step 3: No commit needed unless something was fixed during verification.**

---

## Self-Review Notes

- Every section of the spec maps to at least one task: hero tile (Task 2), segmented bar (Task 3), dept row card (Task 4), ED home (Task 6), drill-down hook (Task 8), drill-down UI (Task 11), role dispatch (Task 12), filter option (Task 13), Exec Dashboard integration (Task 14), cleanup (Task 15).
- Trend delta requirement (Spec §5) implemented in Task 1.
- Manager name on drill-down hero (Spec §5) implemented via the `user_departments` join in Task 8.
- Out-of-scope items (Manager/Staff redesign, notifications, exports) are not in the plan.
- No TBD/TODO placeholders. All code blocks are complete and self-contained.
- Type names match across tasks: `DepartmentSummary`, `GoalWithActivities`, `ActivityWithStatus`, `EdDepartmentView`.
- The `if (programFilter === "performance")` branch in Task 14 renders its own `<ProgramFilterBar />` so the user can switch away — critical for usability.
