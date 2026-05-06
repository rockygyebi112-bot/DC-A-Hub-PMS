# Performance Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Performance Management module to the SRSF MIS where managers set quarterly goals, staff log proof of work against assigned activities, and the ED tracks org-wide progress in real time.

**Architecture:** Three role-based views (ED / Manager / Staff) backed by six new Supabase tables. Activity and goal status is computed on-read — no cron or stored status fields. In-app alerts are derived live from query results. All new routes sit under `/performance` inside the existing `(dashboard)` layout group.

**Tech Stack:** Next.js App Router (v16), Supabase JS v2, Tailwind CSS v4, shadcn/ui (base-ui — `asChild` does NOT work), Lucide React icons, existing `KpiCard` component.

> ⚠️ **Before writing any Next.js page or component:** Read `node_modules/next/dist/docs/` for breaking-change APIs. This version differs from training data.

> ⚠️ **shadcn/ui uses base-ui, not Radix.** `asChild` prop is broken. Select `onValueChange` passes `string | null` — always add `?? ""`.

---

## File Map

### New files
| Path | Purpose |
|------|---------|
| `supabase/migrations/004_performance_management.sql` | 6 new tables, enum update, RLS, seed departments, default permissions |
| `src/lib/performance-utils.ts` | Pure helpers: compute activity status, goal status, expected progress % |
| `src/hooks/use-performance-ed.ts` | Client hook — fetches all dept/goal/activity data for ED view |
| `src/hooks/use-performance-manager.ts` | Client hook — fetches one dept's goals, activities, staff |
| `src/hooks/use-performance-staff.ts` | Client hook — fetches current user's activities by week |
| `src/app/(dashboard)/performance/page.tsx` | Entry point — redirects to correct view based on role |
| `src/app/(dashboard)/performance/[departmentId]/page.tsx` | Manager view page shell |
| `src/app/(dashboard)/performance/me/page.tsx` | Staff view page shell |
| `src/components/performance/ed-dashboard.tsx` | ED view root component |
| `src/components/performance/quarter-selector.tsx` | Q1–Q4 + year picker (shared by ED + Manager) |
| `src/components/performance/department-card.tsx` | Dept progress card used in ED view |
| `src/components/performance/alerts-panel.tsx` | Alerts feed (ED view + Manager alerts tab) |
| `src/components/performance/manager-dashboard.tsx` | Manager view root component with 3 tabs |
| `src/components/performance/goals-activities-tab.tsx` | Expandable goals list with activity rows |
| `src/components/performance/staff-progress-tab.tsx` | Per-staff completion rows |
| `src/components/performance/add-goal-modal.tsx` | Modal: create goal |
| `src/components/performance/add-activity-modal.tsx` | Modal: create activity + assign to staff |
| `src/components/performance/staff-dashboard.tsx` | Staff view root component |
| `src/components/performance/week-navigator.tsx` | Week-by-week scroll navigator |
| `src/components/performance/activity-card.tsx` | Single activity card (pending/done/overdue) |
| `src/components/performance/proof-of-work-modal.tsx` | Mark done: description + file upload |
| `src/components/layout/bottom-nav.tsx` | Mobile bottom navigation bar |

### Modified files
| Path | What changes |
|------|-------------|
| `src/lib/types.ts` | Add 8 performance types |
| `src/lib/constants.ts` | Add Performance to `NAV_ITEMS` + `MODULE_LABELS` |
| `src/app/(dashboard)/layout.tsx` | Add `<BottomNav />` for mobile |
| `src/components/settings/permissions-matrix.tsx` | Add `"performance"` to `MODULES` array |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/004_performance_management.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/004_performance_management.sql

-- ============================================
-- 1. Extend app_module enum
-- ============================================
alter type public.app_module add value if not exists 'performance';

-- ============================================
-- 2. DEPARTMENTS
-- ============================================
create table public.departments (
  id   uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.departments (name) values
  ('MEL'),
  ('IT'),
  ('Admin & HR'),
  ('Finance'),
  ('Marketing & Comms');

-- ============================================
-- 3. USER_DEPARTMENTS
-- ============================================
create table public.user_departments (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.user_profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  is_manager    boolean not null default false,
  unique (user_id)  -- one department per user
);

-- ============================================
-- 4. PERFORMANCE_GOALS
-- ============================================
create table public.performance_goals (
  id            uuid primary key default uuid_generate_v4(),
  department_id uuid not null references public.departments(id) on delete cascade,
  title         text not null,
  description   text,
  year          integer not null,
  quarter       integer not null check (quarter between 1 and 4),
  due_date      date not null,
  created_by    uuid not null references public.user_profiles(id),
  created_at    timestamptz not null default now()
);

-- ============================================
-- 5. PERFORMANCE_ACTIVITIES
-- ============================================
create table public.performance_activities (
  id          uuid primary key default uuid_generate_v4(),
  goal_id     uuid not null references public.performance_goals(id) on delete cascade,
  title       text not null,
  assigned_to uuid not null references public.user_profiles(id),
  due_date    date not null,
  created_by  uuid not null references public.user_profiles(id),
  created_at  timestamptz not null default now()
);

-- ============================================
-- 6. ACTIVITY_SUBMISSIONS
-- ============================================
create table public.activity_submissions (
  id           uuid primary key default uuid_generate_v4(),
  activity_id  uuid not null references public.performance_activities(id) on delete cascade,
  submitted_by uuid not null references public.user_profiles(id),
  description  text not null,
  submitted_at timestamptz not null default now(),
  unique (activity_id)  -- one submission per activity
);

-- ============================================
-- 7. ACTIVITY_ATTACHMENTS
-- ============================================
create table public.activity_attachments (
  id            uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references public.activity_submissions(id) on delete cascade,
  file_name     text not null,
  file_size     integer not null,
  storage_path  text not null,
  uploaded_at   timestamptz not null default now()
);

-- ============================================
-- 8. RLS — enable on all tables
-- ============================================
alter table public.departments          enable row level security;
alter table public.user_departments     enable row level security;
alter table public.performance_goals    enable row level security;
alter table public.performance_activities enable row level security;
alter table public.activity_submissions enable row level security;
alter table public.activity_attachments enable row level security;

-- Read: any authenticated user
create policy "auth_read_departments"           on public.departments          for select using (auth.role() = 'authenticated');
create policy "auth_read_user_departments"      on public.user_departments     for select using (auth.role() = 'authenticated');
create policy "auth_read_performance_goals"     on public.performance_goals    for select using (auth.role() = 'authenticated');
create policy "auth_read_performance_activities" on public.performance_activities for select using (auth.role() = 'authenticated');
create policy "auth_read_activity_submissions"  on public.activity_submissions for select using (auth.role() = 'authenticated');
create policy "auth_read_activity_attachments"  on public.activity_attachments for select using (auth.role() = 'authenticated');

-- Write: any authenticated user (app layer enforces business rules)
create policy "auth_write_departments"          on public.departments          for all using (auth.role() = 'authenticated');
create policy "auth_write_user_departments"     on public.user_departments     for all using (auth.role() = 'authenticated');
create policy "auth_write_performance_goals"    on public.performance_goals    for all using (auth.role() = 'authenticated');
create policy "auth_write_performance_activities" on public.performance_activities for all using (auth.role() = 'authenticated');
create policy "auth_write_activity_submissions" on public.activity_submissions for all using (auth.role() = 'authenticated');
create policy "auth_write_activity_attachments" on public.activity_attachments for all using (auth.role() = 'authenticated');

-- ============================================
-- 9. Supabase Storage bucket
-- ============================================
insert into storage.buckets (id, name, public)
values ('performance-attachments', 'performance-attachments', false)
on conflict do nothing;

-- ============================================
-- 10. Default permissions for 'performance' module
-- ============================================
-- Admin: allowed
insert into public.role_permissions (role_id, module, allowed)
select id, 'performance', true from public.roles where name = 'Admin';

-- Program Manager: allowed
insert into public.role_permissions (role_id, module, allowed)
select id, 'performance', true from public.roles where name = 'Program Manager';

-- Data Entry Officer: allowed
insert into public.role_permissions (role_id, module, allowed)
select id, 'performance', true from public.roles where name = 'Data Entry Officer';

-- Viewer: not allowed
insert into public.role_permissions (role_id, module, allowed)
select id, 'performance', false from public.roles where name = 'Viewer';
```

- [ ] **Step 2: Apply the migration in Supabase dashboard**

Open Supabase dashboard → SQL Editor → paste and run the file contents. Verify:
- Tables `departments`, `user_departments`, `performance_goals`, `performance_activities`, `activity_submissions`, `activity_attachments` appear in Table Editor
- `departments` table has 5 rows (MEL, IT, Admin & HR, Finance, Marketing & Comms)
- `role_permissions` has new rows for `performance` module

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_performance_management.sql
git commit -m "feat: add performance management DB migration (6 tables + RLS + seed)"
```

---

## Task 2: Types & Constants

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Add performance types to `src/lib/types.ts`**

Append to the end of the file:

```typescript
// ============================================
// PERFORMANCE MANAGEMENT
// ============================================

export type ActivityStatus = "pending" | "done" | "overdue";
export type GoalStatus = "on_track" | "at_risk" | "behind";

export interface Department {
  id: string;
  name: string;
  created_at: string;
}

export interface UserDepartment {
  id: string;
  user_id: string;
  department_id: string;
  is_manager: boolean;
}

export interface PerformanceGoal {
  id: string;
  department_id: string;
  title: string;
  description: string | null;
  year: number;
  quarter: number;
  due_date: string;
  created_by: string;
  created_at: string;
}

export interface PerformanceActivity {
  id: string;
  goal_id: string;
  title: string;
  assigned_to: string;
  due_date: string;
  created_by: string;
  created_at: string;
}

export interface ActivitySubmission {
  id: string;
  activity_id: string;
  submitted_by: string;
  description: string;
  submitted_at: string;
}

export interface ActivityAttachment {
  id: string;
  submission_id: string;
  file_name: string;
  file_size: number;
  storage_path: string;
  uploaded_at: string;
}

// Enriched shapes used in UI (assembled from joined queries)
export interface ActivityWithStatus extends PerformanceActivity {
  status: ActivityStatus;
  submission: ActivitySubmission | null;
  attachments: ActivityAttachment[];
  assignee: { full_name: string; email: string };
}

export interface GoalWithActivities extends PerformanceGoal {
  activities: ActivityWithStatus[];
  status: GoalStatus;
  progress_pct: number;
}

export interface DepartmentSummary extends Department {
  goals: GoalWithActivities[];
  progress_pct: number;
  status: GoalStatus;
  staff_count: number;
  done_count: number;
  pending_count: number;
  overdue_count: number;
}
```

- [ ] **Step 2: Update `AppModule` union in `src/lib/types.ts`**

Change:
```typescript
export type AppModule =
  | "executive_dashboard"
  | "program_dashboards"
  | "data_entry"
  | "indicators"
  | "learnings"
  | "settings";
```
To:
```typescript
export type AppModule =
  | "executive_dashboard"
  | "program_dashboards"
  | "data_entry"
  | "indicators"
  | "learnings"
  | "settings"
  | "performance";
```

- [ ] **Step 3: Add Performance to `src/lib/constants.ts`**

Add `Target` to the lucide-react import at the top:
```typescript
import {
  LayoutDashboard,
  BarChart3,
  ClipboardEdit,
  SlidersHorizontal,
  Lightbulb,
  Settings,
  Target,
  LucideIcon,
} from "lucide-react";
```

Add to `NAV_ITEMS` array (before Settings):
```typescript
  {
    label: "Performance",
    href: "/performance",
    icon: Target,
    module: "performance",
  },
```

Add to `MODULE_LABELS`:
```typescript
  performance: "Performance Management",
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd C:/Users/ishma/Desktop/springboard-mis/.claude/worktrees/great-chatterjee
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add performance types and nav item"
```

---

## Task 3: Performance Utility Helpers

**Files:**
- Create: `src/lib/performance-utils.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/performance-utils.ts
import type {
  PerformanceActivity,
  ActivitySubmission,
  ActivityStatus,
  GoalStatus,
} from "./types";

/**
 * Derive activity status from its submission and due date.
 * Status is never stored — always computed at read time.
 */
export function computeActivityStatus(
  activity: PerformanceActivity,
  submission: ActivitySubmission | null
): ActivityStatus {
  if (submission) return "done";
  if (new Date(activity.due_date) < new Date()) return "overdue";
  return "pending";
}

/**
 * Returns the expected completion % for a given quarter/year
 * based on how far through the quarter today is.
 * Returns 0 if the quarter hasn't started, 100 if it has ended.
 */
export function getExpectedProgress(quarter: number, year: number): number {
  const now = new Date();
  const quarterStart = new Date(year, (quarter - 1) * 3, 1);
  const quarterEnd = new Date(year, quarter * 3, 0, 23, 59, 59);

  if (now < quarterStart) return 0;
  if (now > quarterEnd) return 100;

  const elapsed = now.getTime() - quarterStart.getTime();
  const total = quarterEnd.getTime() - quarterStart.getTime();
  return (elapsed / total) * 100;
}

/**
 * Derive goal/department status from actual vs expected progress.
 * - Behind: >30% below expected OR any activity is overdue
 * - At Risk: 15–30% below expected
 * - On Track: within 15% of expected (or ahead)
 */
export function computeGoalStatus(
  progressPct: number,
  expectedPct: number,
  hasOverdue: boolean
): GoalStatus {
  if (hasOverdue || progressPct < expectedPct - 30) return "behind";
  if (progressPct < expectedPct - 15) return "at_risk";
  return "on_track";
}

/** Human-readable label for GoalStatus */
export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  behind: "Behind",
};

/** Tailwind colour classes for each status (pill bg + text) */
export const GOAL_STATUS_CLASSES: Record<GoalStatus, string> = {
  on_track: "bg-green-100 text-green-800",
  at_risk: "bg-amber-100 text-amber-800",
  behind: "bg-red-100 text-red-800",
};

/** Tailwind colour class for ActivityStatus (used in activity cards) */
export const ACTIVITY_STATUS_CLASSES: Record<ActivityStatus, string> = {
  pending: "text-muted-foreground",
  done: "text-green-600",
  overdue: "text-red-600",
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/performance-utils.ts
git commit -m "feat: add performance utility helpers (status computation)"
```

---

## Task 4: Permissions Matrix Update

**Files:**
- Modify: `src/components/settings/permissions-matrix.tsx`

- [ ] **Step 1: Add `"performance"` to the `MODULES` array**

Find the `MODULES` constant (line 18) and change it to:
```typescript
const MODULES: AppModule[] = [
  "executive_dashboard",
  "program_dashboards",
  "data_entry",
  "indicators",
  "learnings",
  "performance",
  "settings",
];
```

- [ ] **Step 2: Verify in browser**

Navigate to `/settings`. The permissions matrix should show a new "Performance Management" row for all roles.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/permissions-matrix.tsx
git commit -m "feat: add performance module to permissions matrix"
```

---

## Task 5: ED Data Hook

**Files:**
- Create: `src/hooks/use-performance-ed.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/use-performance-ed.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  computeActivityStatus,
  computeGoalStatus,
  getExpectedProgress,
} from "@/lib/performance-utils";
import type {
  Department,
  DepartmentSummary,
  GoalWithActivities,
  ActivityWithStatus,
} from "@/lib/types";

export function usePerformanceEd(year: number, quarter: number) {
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // 1. Fetch all departments
    const { data: depts, error: deptsErr } = await supabase
      .from("departments")
      .select("*")
      .order("name");

    if (deptsErr) { setError(deptsErr.message); setLoading(false); return; }

    // 2. Fetch goals for this year/quarter with nested activities + submissions + attachments
    const { data: goals, error: goalsErr } = await supabase
      .from("performance_goals")
      .select(`
        *,
        activities:performance_activities (
          *,
          assignee:user_profiles!assigned_to ( full_name, email ),
          submission:activity_submissions (
            *,
            attachments:activity_attachments ( * )
          )
        )
      `)
      .eq("year", year)
      .eq("quarter", quarter);

    if (goalsErr) { setError(goalsErr.message); setLoading(false); return; }

    // 3. Fetch staff counts per department
    const { data: staffRows } = await supabase
      .from("user_departments")
      .select("department_id");

    const staffCountMap: Record<string, number> = {};
    (staffRows ?? []).forEach((r: { department_id: string }) => {
      staffCountMap[r.department_id] = (staffCountMap[r.department_id] ?? 0) + 1;
    });

    // 4. Assemble DepartmentSummary for each department
    const expectedPct = getExpectedProgress(quarter, year);

    const summaries: DepartmentSummary[] = (depts as Department[]).map((dept) => {
      const deptGoals = (goals ?? []).filter((g: { department_id: string }) => g.department_id === dept.id);

      const enrichedGoals: GoalWithActivities[] = deptGoals.map((goal: Record<string, unknown>) => {
        const rawActivities = (goal.activities as Record<string, unknown>[] ?? []);
        const activities: ActivityWithStatus[] = rawActivities.map((act: Record<string, unknown>) => {
          const submission = (act.submission as { id: string; activity_id: string; submitted_by: string; description: string; submitted_at: string; attachments: { id: string; submission_id: string; file_name: string; file_size: number; storage_path: string; uploaded_at: string }[] } | null) ?? null;
          return {
            ...(act as { id: string; goal_id: string; title: string; assigned_to: string; due_date: string; created_by: string; created_at: string; assignee: { full_name: string; email: string } }),
            status: computeActivityStatus(
              act as { id: string; goal_id: string; title: string; assigned_to: string; due_date: string; created_by: string; created_at: string },
              submission
            ),
            submission: submission ? { id: submission.id, activity_id: submission.activity_id, submitted_by: submission.submitted_by, description: submission.description, submitted_at: submission.submitted_at } : null,
            attachments: submission?.attachments ?? [],
          };
        });

        const done = activities.filter((a) => a.status === "done").length;
        const total = activities.length;
        const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);
        const hasOverdue = activities.some((a) => a.status === "overdue");

        return {
          ...(goal as { id: string; department_id: string; title: string; description: string | null; year: number; quarter: number; due_date: string; created_by: string; created_at: string }),
          activities,
          progress_pct: progressPct,
          status: computeGoalStatus(progressPct, expectedPct, hasOverdue),
        };
      });

      const allActivities = enrichedGoals.flatMap((g) => g.activities);
      const done = allActivities.filter((a) => a.status === "done").length;
      const pending = allActivities.filter((a) => a.status === "pending").length;
      const overdue = allActivities.filter((a) => a.status === "overdue").length;
      const total = allActivities.length;
      const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);
      const hasOverdue = overdue > 0;

      return {
        ...dept,
        goals: enrichedGoals,
        progress_pct: progressPct,
        status: computeGoalStatus(progressPct, expectedPct, hasOverdue),
        staff_count: staffCountMap[dept.id] ?? 0,
        done_count: done,
        pending_count: pending,
        overdue_count: overdue,
      };
    });

    setDepartments(summaries);
    setLoading(false);
  }, [year, quarter]);

  useEffect(() => { load(); }, [load]);

  return { departments, loading, error, reload: load };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-performance-ed.ts
git commit -m "feat: add ED performance data hook"
```

---

## Task 6: ED View Components

**Files:**
- Create: `src/components/performance/quarter-selector.tsx`
- Create: `src/components/performance/department-card.tsx`
- Create: `src/components/performance/alerts-panel.tsx`
- Create: `src/components/performance/ed-dashboard.tsx`

- [ ] **Step 1: Create `quarter-selector.tsx`**

```tsx
// src/components/performance/quarter-selector.tsx
"use client";

interface QuarterSelectorProps {
  year: number;
  quarter: number;
  onYearChange: (y: number) => void;
  onQuarterChange: (q: number) => void;
}

export function QuarterSelector({
  year,
  quarter,
  onYearChange,
  onQuarterChange,
}: QuarterSelectorProps) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Year selector */}
      <select
        value={year}
        onChange={(e) => onYearChange(Number(e.target.value))}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* Quarter tabs */}
      <div className="flex rounded-md border border-input overflow-hidden">
        {[1, 2, 3, 4].map((q) => (
          <button
            key={q}
            onClick={() => onQuarterChange(q)}
            className={`px-4 h-9 text-sm font-medium transition-colors ${
              quarter === q
                ? "bg-[#6B2D7B] text-white"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            Q{q}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `department-card.tsx`**

```tsx
// src/components/performance/department-card.tsx
"use client";

import { useRouter } from "next/navigation";
import { Users, ChevronRight } from "lucide-react";
import {
  GOAL_STATUS_LABEL,
  GOAL_STATUS_CLASSES,
} from "@/lib/performance-utils";
import type { DepartmentSummary } from "@/lib/types";

interface DepartmentCardProps {
  dept: DepartmentSummary;
}

export function DepartmentCard({ dept }: DepartmentCardProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/performance/${dept.id}`)}
      className="w-full text-left rounded-xl border border-border/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200 active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{dept.name}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Users className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {dept.staff_count} staff
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              GOAL_STATUS_CLASSES[dept.status]
            }`}
          >
            {GOAL_STATUS_LABEL[dept.status]}
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Progress</span>
          <span className="font-semibold">{dept.progress_pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-[#5BBF3A] transition-all duration-500"
            style={{ width: `${dept.progress_pct}%` }}
          />
        </div>
      </div>

      {/* Activity counts */}
      <div className="flex gap-4 mt-3 text-xs">
        <span className="text-green-600 font-medium">✓ {dept.done_count} done</span>
        <span className="text-muted-foreground">· {dept.pending_count} pending</span>
        {dept.overdue_count > 0 && (
          <span className="text-red-600 font-medium">
            ⚠ {dept.overdue_count} overdue
          </span>
        )}
      </div>
    </button>
  );
}
```

- [ ] **Step 3: Create `alerts-panel.tsx`**

```tsx
// src/components/performance/alerts-panel.tsx
"use client";

import { AlertTriangle, Clock } from "lucide-react";
import type { DepartmentSummary, ActivityWithStatus } from "@/lib/types";

interface AlertItem {
  type: "overdue_activity" | "behind_department";
  label: string;
  sub: string;
}

interface AlertsPanelProps {
  departments: DepartmentSummary[];
}

function buildAlerts(departments: DepartmentSummary[]): AlertItem[] {
  const alerts: AlertItem[] = [];

  departments.forEach((dept) => {
    // Overdue activities
    dept.goals.forEach((goal) => {
      goal.activities
        .filter((a) => a.status === "overdue")
        .forEach((a: ActivityWithStatus) => {
          alerts.push({
            type: "overdue_activity",
            label: a.title,
            sub: `${dept.name} · Due ${new Date(a.due_date).toLocaleDateString("en-GB")} · ${a.assignee.full_name}`,
          });
        });
    });

    // Behind department
    if (dept.status === "behind") {
      alerts.push({
        type: "behind_department",
        label: `${dept.name} is behind`,
        sub: `${dept.progress_pct}% complete`,
      });
    }
  });

  return alerts;
}

export function AlertsPanel({ departments }: AlertsPanelProps) {
  const alerts = buildAlerts(departments);

  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-white p-5 text-center text-sm text-muted-foreground">
        No active alerts — all departments are on track.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-white divide-y divide-border/40">
      {alerts.map((alert, i) => (
        <div key={i} className="flex items-start gap-3 p-4">
          <div
            className={`mt-0.5 shrink-0 rounded-full p-1 ${
              alert.type === "overdue_activity"
                ? "bg-red-100 text-red-600"
                : "bg-amber-100 text-amber-600"
            }`}
          >
            {alert.type === "overdue_activity" ? (
              <Clock className="size-3.5" />
            ) : (
              <AlertTriangle className="size-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {alert.label}
            </p>
            <p className="text-xs text-muted-foreground">{alert.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `ed-dashboard.tsx`**

```tsx
// src/components/performance/ed-dashboard.tsx
"use client";

import { useState } from "react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { QuarterSelector } from "./quarter-selector";
import { DepartmentCard } from "./department-card";
import { AlertsPanel } from "./alerts-panel";
import { usePerformanceEd } from "@/hooks/use-performance-ed";

export function EdDashboard() {
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);

  const { departments, loading, error } = usePerformanceEd(year, quarter);

  const onTrackCount = departments.filter((d) => d.status === "on_track").length;
  const atRiskCount = departments.filter((d) => d.status === "at_risk").length;
  const behindCount = departments.filter((d) => d.status === "behind").length;
  const overdueCount = departments.reduce((s, d) => s + d.overdue_count, 0);
  const totalActivities = departments.reduce(
    (s, d) => s + d.done_count + d.pending_count + d.overdue_count,
    0
  );
  const doneActivities = departments.reduce((s, d) => s + d.done_count, 0);
  const overallPct =
    totalActivities === 0 ? 0 : Math.round((doneActivities / totalActivities) * 100);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Failed to load performance data: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
        <QuarterSelector
          year={year}
          quarter={quarter}
          onYearChange={setYear}
          onQuarterChange={setQuarter}
        />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Overall" value={`${overallPct}%`} accent="green" />
        <KpiCard label="On Track" value={onTrackCount} accent="green" />
        <KpiCard label="At Risk" value={atRiskCount} accent="amber" />
        <KpiCard label="Overdue" value={overdueCount} accent="purple" />
      </div>

      {/* Department cards */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <DepartmentCard key={dept.id} dept={dept} />
          ))}
        </div>
      )}

      {/* Alerts */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Alerts
        </h2>
        <AlertsPanel departments={departments} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/performance/
git commit -m "feat: add ED view components (quarter selector, dept cards, alerts, dashboard)"
```

---

## Task 7: ED Page + Role Routing

**Files:**
- Create: `src/app/(dashboard)/performance/page.tsx`

- [ ] **Step 1: Create the page**

This page checks the user's role and department status, then renders the correct view or redirects.

```tsx
// src/app/(dashboard)/performance/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { EdDashboard } from "@/components/performance/ed-dashboard";

export default function PerformancePage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;

    async function checkRole() {
      const supabase = createClient();

      // Admin → stays on this page (ED view)
      if (user?.role?.name === "Admin") return;

      // Check if user is a department manager
      const { data: ud } = await supabase
        .from("user_departments")
        .select("department_id, is_manager")
        .eq("user_id", user!.id)
        .single();

      if (ud?.is_manager) {
        router.replace(`/performance/${ud.department_id}`);
      } else {
        router.replace("/performance/me");
      }
    }

    checkRole();
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Only Admin sees this — others get redirected above
  if (user?.role?.name !== "Admin") return null;

  return <EdDashboard />;
}
```

- [ ] **Step 2: Verify in browser**

- Log in as an Admin user → navigate to `/performance` → ED dashboard should render with 5 department cards
- Log in as a non-Admin user with no department → should redirect to `/performance/me`

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/performance/page.tsx
git commit -m "feat: add performance entry page with role-based routing"
```

---

## Task 8: Manager Data Hook

**Files:**
- Create: `src/hooks/use-performance-manager.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/use-performance-manager.ts
"use client";

import { useEffect, useState, useCallback } from "react";
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
  UserProfile,
} from "@/lib/types";

export interface StaffMemberProgress {
  user: UserProfile;
  total: number;
  done: number;
  overdue: number;
  pct: number;
}

export interface ManagerData {
  department: Department | null;
  goals: GoalWithActivities[];
  staff: StaffMemberProgress[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function usePerformanceManager(
  departmentId: string,
  year: number,
  quarter: number
): ManagerData {
  const [department, setDepartment] = useState<Department | null>(null);
  const [goals, setGoals] = useState<GoalWithActivities[]>([]);
  const [staff, setStaff] = useState<StaffMemberProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // Department info
    const { data: dept, error: deptErr } = await supabase
      .from("departments")
      .select("*")
      .eq("id", departmentId)
      .single();

    if (deptErr) { setError(deptErr.message); setLoading(false); return; }

    // Goals with activities
    const { data: rawGoals, error: goalsErr } = await supabase
      .from("performance_goals")
      .select(`
        *,
        activities:performance_activities (
          *,
          assignee:user_profiles!assigned_to ( id, full_name, email ),
          submission:activity_submissions (
            *,
            attachments:activity_attachments ( * )
          )
        )
      `)
      .eq("department_id", departmentId)
      .eq("year", year)
      .eq("quarter", quarter)
      .order("created_at");

    if (goalsErr) { setError(goalsErr.message); setLoading(false); return; }

    const expectedPct = getExpectedProgress(quarter, year);

    const enrichedGoals: GoalWithActivities[] = (rawGoals ?? []).map(
      (goal: Record<string, unknown>) => {
        const rawActivities = (goal.activities as Record<string, unknown>[] ?? []);
        const activities: ActivityWithStatus[] = rawActivities.map(
          (act: Record<string, unknown>) => {
            const submission = (act.submission as { id: string; activity_id: string; submitted_by: string; description: string; submitted_at: string; attachments: { id: string; submission_id: string; file_name: string; file_size: number; storage_path: string; uploaded_at: string }[] } | null) ?? null;
            return {
              ...(act as { id: string; goal_id: string; title: string; assigned_to: string; due_date: string; created_by: string; created_at: string; assignee: { full_name: string; email: string } }),
              status: computeActivityStatus(
                act as { id: string; goal_id: string; title: string; assigned_to: string; due_date: string; created_by: string; created_at: string },
                submission
              ),
              submission: submission ? { id: submission.id, activity_id: submission.activity_id, submitted_by: submission.submitted_by, description: submission.description, submitted_at: submission.submitted_at } : null,
              attachments: submission?.attachments ?? [],
            };
          }
        );

        const done = activities.filter((a) => a.status === "done").length;
        const total = activities.length;
        const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);
        const hasOverdue = activities.some((a) => a.status === "overdue");

        return {
          ...(goal as { id: string; department_id: string; title: string; description: string | null; year: number; quarter: number; due_date: string; created_by: string; created_at: string }),
          activities,
          progress_pct: progressPct,
          status: computeGoalStatus(progressPct, expectedPct, hasOverdue),
        };
      }
    );

    // Staff members in this department
    const { data: udRows } = await supabase
      .from("user_departments")
      .select("user_id, user:user_profiles ( id, full_name, email, role_id, status, created_at, updated_at )")
      .eq("department_id", departmentId);

    const allActivities = enrichedGoals.flatMap((g) => g.activities);

    const staffProgress: StaffMemberProgress[] = (udRows ?? []).map(
      (row: { user_id: string; user: Record<string, unknown> }) => {
        const userActivities = allActivities.filter(
          (a) => a.assigned_to === row.user_id
        );
        const done = userActivities.filter((a) => a.status === "done").length;
        const overdue = userActivities.filter((a) => a.status === "overdue").length;
        const total = userActivities.length;
        return {
          user: row.user as unknown as UserProfile,
          total,
          done,
          overdue,
          pct: total === 0 ? 0 : Math.round((done / total) * 100),
        };
      }
    );

    setDepartment(dept as Department);
    setGoals(enrichedGoals);
    setStaff(staffProgress);
    setLoading(false);
  }, [departmentId, year, quarter]);

  useEffect(() => { load(); }, [load]);

  return { department, goals, staff, loading, error, reload: load };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-performance-manager.ts
git commit -m "feat: add manager performance data hook"
```

---

## Task 9: Add Goal & Add Activity Modals

**Files:**
- Create: `src/components/performance/add-goal-modal.tsx`
- Create: `src/components/performance/add-activity-modal.tsx`

- [ ] **Step 1: Create `add-goal-modal.tsx`**

```tsx
// src/components/performance/add-goal-modal.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AddGoalModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  departmentId: string;
  year: number;
  quarter: number;
  createdBy: string;
}

export function AddGoalModal({
  open,
  onClose,
  onCreated,
  departmentId,
  year,
  quarter,
  createdBy,
}: AddGoalModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("performance_goals").insert({
      department_id: departmentId,
      title: title.trim(),
      description: description.trim() || null,
      year,
      quarter,
      due_date: dueDate,
      created_by: createdBy,
    });

    if (error) {
      toast.error("Failed to create goal: " + error.message);
    } else {
      toast.success("Goal created");
      setTitle("");
      setDescription("");
      setDueDate("");
      onCreated();
      onClose();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Goal — Q{quarter} {year}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="goal-title">Goal title *</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Publish Q2 impact report"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-desc">Description (optional)</Label>
            <Textarea
              id="goal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Additional context..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-due">Due date *</Label>
            <Input
              id="goal-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Create Goal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create `add-activity-modal.tsx`**

```tsx
// src/components/performance/add-activity-modal.tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StaffMemberProgress } from "@/hooks/use-performance-manager";

interface AddActivityModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  goalId: string;
  goalTitle: string;
  staff: StaffMemberProgress[];
  createdBy: string;
}

export function AddActivityModal({
  open,
  onClose,
  onCreated,
  goalId,
  goalTitle,
  staff,
  createdBy,
}: AddActivityModalProps) {
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !assignedTo || !dueDate) return;

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("performance_activities").insert({
      goal_id: goalId,
      title: title.trim(),
      assigned_to: assignedTo,
      due_date: dueDate,
      created_by: createdBy,
    });

    if (error) {
      toast.error("Failed to create activity: " + error.message);
    } else {
      toast.success("Activity added");
      setTitle("");
      setAssignedTo("");
      setDueDate("");
      onCreated();
      onClose();
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Activity</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          Goal: <span className="font-medium text-foreground">{goalTitle}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="act-title">Activity title *</Label>
            <Input
              id="act-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Draft executive summary"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-assign">Assign to *</Label>
            <select
              id="act-assign"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value ?? "")}
              required
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select staff member…</option>
              {staff.map((s) => (
                <option key={s.user.id} value={s.user.id}>
                  {s.user.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-due">Due date *</Label>
            <Input
              id="act-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add Activity"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/performance/add-goal-modal.tsx src/components/performance/add-activity-modal.tsx
git commit -m "feat: add goal and activity creation modals"
```

---

## Task 10: Manager View Components

**Files:**
- Create: `src/components/performance/goals-activities-tab.tsx`
- Create: `src/components/performance/staff-progress-tab.tsx`
- Create: `src/components/performance/manager-dashboard.tsx`

- [ ] **Step 1: Create `goals-activities-tab.tsx`**

```tsx
// src/components/performance/goals-activities-tab.tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddActivityModal } from "./add-activity-modal";
import {
  GOAL_STATUS_CLASSES,
  GOAL_STATUS_LABEL,
  ACTIVITY_STATUS_CLASSES,
} from "@/lib/performance-utils";
import type { GoalWithActivities, ActivityWithStatus } from "@/lib/types";
import type { StaffMemberProgress } from "@/hooks/use-performance-manager";

interface GoalsActivitiesTabProps {
  goals: GoalWithActivities[];
  staff: StaffMemberProgress[];
  currentUserId: string;
  onAddGoal: () => void;
  onReload: () => void;
}

function ActivityRow({ activity }: { activity: ActivityWithStatus }) {
  const dueDate = new Date(activity.due_date);
  const dueDateLabel = dueDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50">
      <div
        className={`mt-0.5 size-2 rounded-full shrink-0 ${
          activity.status === "done"
            ? "bg-green-500"
            : activity.status === "overdue"
            ? "bg-red-500"
            : "bg-muted-foreground/40"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${
            activity.status === "done"
              ? "line-through text-muted-foreground"
              : "text-foreground"
          }`}
        >
          {activity.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {activity.assignee.full_name}
          </span>
          <span
            className={`text-xs font-medium ${
              activity.status === "overdue"
                ? "text-red-600"
                : "text-muted-foreground"
            }`}
          >
            · Due {dueDateLabel}
          </span>
          {activity.submission && (
            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">
              <Paperclip className="size-2.5" />
              Proof submitted
            </span>
          )}
        </div>
      </div>
      <span
        className={`text-xs font-medium shrink-0 ${
          ACTIVITY_STATUS_CLASSES[activity.status]
        }`}
      >
        {activity.status}
      </span>
    </div>
  );
}

function GoalRow({
  goal,
  staff,
  currentUserId,
  onReload,
}: {
  goal: GoalWithActivities;
  staff: StaffMemberProgress[];
  currentUserId: string;
  onReload: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addActivityOpen, setAddActivityOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border/60 bg-white overflow-hidden">
      {/* Goal header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/30"
      >
        {expanded ? (
          <ChevronDown className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{goal.title}</p>
          {goal.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {goal.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
              <div
                className="h-full rounded-full bg-[#5BBF3A]"
                style={{ width: `${goal.progress_pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {goal.progress_pct}%
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                GOAL_STATUS_CLASSES[goal.status]
              }`}
            >
              {GOAL_STATUS_LABEL[goal.status]}
            </span>
          </div>
        </div>
      </button>

      {/* Activity list */}
      {expanded && (
        <div className="border-t border-border/40 px-2 pb-2">
          {goal.activities.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              No activities yet
            </p>
          ) : (
            goal.activities.map((act) => (
              <ActivityRow key={act.id} activity={act} />
            ))
          )}
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2 h-8 text-xs"
            onClick={() => setAddActivityOpen(true)}
          >
            <Plus className="size-3.5 mr-1" />
            Add activity
          </Button>
        </div>
      )}

      <AddActivityModal
        open={addActivityOpen}
        onClose={() => setAddActivityOpen(false)}
        onCreated={onReload}
        goalId={goal.id}
        goalTitle={goal.title}
        staff={staff}
        createdBy={currentUserId}
      />
    </div>
  );
}

export function GoalsActivitiesTab({
  goals,
  staff,
  currentUserId,
  onAddGoal,
  onReload,
}: GoalsActivitiesTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={onAddGoal}>
          <Plus className="size-4 mr-1.5" />
          Add Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No goals for this quarter yet. Add one to get started.
        </div>
      ) : (
        goals.map((goal) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            staff={staff}
            currentUserId={currentUserId}
            onReload={onReload}
          />
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `staff-progress-tab.tsx`**

```tsx
// src/components/performance/staff-progress-tab.tsx
"use client";

import type { StaffMemberProgress } from "@/hooks/use-performance-manager";

interface StaffProgressTabProps {
  staff: StaffMemberProgress[];
}

export function StaffProgressTab({ staff }: StaffProgressTabProps) {
  if (staff.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No staff assigned to this department yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {staff.map((s) => (
        <div
          key={s.user.id}
          className="flex items-center gap-4 rounded-xl border border-border/60 bg-white p-4"
        >
          {/* Avatar */}
          <div className="size-9 rounded-full bg-[#6B2D7B] text-white flex items-center justify-center text-sm font-semibold shrink-0">
            {s.user.full_name.charAt(0).toUpperCase()}
          </div>

          {/* Name + progress */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{s.user.full_name}</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#5BBF3A]"
                  style={{ width: `${s.pct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {s.done}/{s.total}
              </span>
            </div>
          </div>

          {/* Pct */}
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-[#6B2D7B]">{s.pct}%</p>
            {s.overdue > 0 && (
              <p className="text-xs text-red-500">{s.overdue} overdue</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `manager-dashboard.tsx`**

```tsx
// src/components/performance/manager-dashboard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell } from "lucide-react";
import { QuarterSelector } from "./quarter-selector";
import { GoalsActivitiesTab } from "./goals-activities-tab";
import { StaffProgressTab } from "./staff-progress-tab";
import { AlertsPanel } from "./alerts-panel";
import { AddGoalModal } from "./add-goal-modal";
import { usePerformanceManager } from "@/hooks/use-performance-manager";
import { useUser } from "@/hooks/use-user";

const TABS = ["Goals & Activities", "Staff", "Alerts"] as const;
type Tab = (typeof TABS)[number];

interface ManagerDashboardProps {
  departmentId: string;
}

export function ManagerDashboard({ departmentId }: ManagerDashboardProps) {
  const { user } = useUser();
  const router = useRouter();

  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);
  const [activeTab, setActiveTab] = useState<Tab>("Goals & Activities");
  const [addGoalOpen, setAddGoalOpen] = useState(false);

  const { department, goals, staff, loading, error, reload } =
    usePerformanceManager(departmentId, year, quarter);

  const overdueCount = goals
    .flatMap((g) => g.activities)
    .filter((a) => a.status === "overdue").length;

  const doneCount = goals
    .flatMap((g) => g.activities)
    .filter((a) => a.status === "done").length;

  const totalCount = goals.flatMap((g) => g.activities).length;
  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  // Wrap dept into DepartmentSummary shape for AlertsPanel
  const deptSummary = department
    ? {
        ...department,
        goals,
        progress_pct: pct,
        status: goals[0]?.status ?? "on_track" as const,
        staff_count: staff.length,
        done_count: doneCount,
        pending_count: goals.flatMap((g) => g.activities).filter((a) => a.status === "pending").length,
        overdue_count: overdueCount,
      }
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/performance")}
          className="size-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">
            {loading ? "Loading…" : (department?.name ?? "Department")}
          </h1>
          {!loading && (
            <p className="text-xs text-muted-foreground">
              {pct}% complete · {doneCount} done ·{" "}
              {overdueCount > 0 && (
                <span className="text-red-500">{overdueCount} overdue</span>
              )}
            </p>
          )}
        </div>
        <div className="relative">
          <Bell className="size-5 text-muted-foreground" />
          {overdueCount > 0 && (
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-red-500" />
          )}
        </div>
      </div>

      {/* Quarter selector */}
      <QuarterSelector
        year={year}
        quarter={quarter}
        onYearChange={setYear}
        onQuarterChange={setQuarter}
      />

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? "text-[#6B2D7B]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
            {tab === "Alerts" && overdueCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center size-4 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {overdueCount}
              </span>
            )}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#6B2D7B]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {activeTab === "Goals & Activities" && user && (
            <GoalsActivitiesTab
              goals={goals}
              staff={staff}
              currentUserId={user.id}
              onAddGoal={() => setAddGoalOpen(true)}
              onReload={reload}
            />
          )}
          {activeTab === "Staff" && <StaffProgressTab staff={staff} />}
          {activeTab === "Alerts" && deptSummary && (
            <AlertsPanel departments={[deptSummary]} />
          )}
        </>
      )}

      {/* Add Goal modal */}
      {user && (
        <AddGoalModal
          open={addGoalOpen}
          onClose={() => setAddGoalOpen(false)}
          onCreated={reload}
          departmentId={departmentId}
          year={year}
          quarter={quarter}
          createdBy={user.id}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/performance/goals-activities-tab.tsx src/components/performance/staff-progress-tab.tsx src/components/performance/manager-dashboard.tsx
git commit -m "feat: add manager view components (goals, staff, alerts tabs)"
```

---

## Task 11: Manager Page

**Files:**
- Create: `src/app/(dashboard)/performance/[departmentId]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/app/(dashboard)/performance/[departmentId]/page.tsx
import { ManagerDashboard } from "@/components/performance/manager-dashboard";

interface Props {
  params: Promise<{ departmentId: string }>;
}

export default async function ManagerPage({ params }: Props) {
  const { departmentId } = await params;
  return <ManagerDashboard departmentId={departmentId} />;
}
```

- [ ] **Step 2: Verify in browser**

- As an Admin: navigate to `/performance` → click a department card → Manager view should render with tabs
- Verify the three tabs (Goals & Activities / Staff / Alerts) switch correctly

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/performance/[departmentId]/page.tsx"
git commit -m "feat: add manager view page"
```

---

## Task 12: Staff Data Hook

**Files:**
- Create: `src/hooks/use-performance-staff.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/use-performance-staff.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeActivityStatus } from "@/lib/performance-utils";
import type { ActivityWithStatus, GoalWithActivities, Department } from "@/lib/types";

export interface StaffData {
  department: Department | null;
  goalTitle: string | null;
  deptProgressPct: number;
  activities: ActivityWithStatus[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Returns start/end of the ISO week containing `date` */
function getWeekBounds(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMon);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function usePerformanceStaff(userId: string, weekDate: Date): StaffData {
  const [department, setDepartment] = useState<Department | null>(null);
  const [goalTitle, setGoalTitle] = useState<string | null>(null);
  const [deptProgressPct, setDeptProgressPct] = useState(0);
  const [activities, setActivities] = useState<ActivityWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // Get user's department
    const { data: ud, error: udErr } = await supabase
      .from("user_departments")
      .select("department_id, department:departments(*)")
      .eq("user_id", userId)
      .single();

    if (udErr || !ud) {
      setDepartment(null);
      setActivities([]);
      setLoading(false);
      return;
    }

    setDepartment(ud.department as unknown as Department);

    const { start, end } = getWeekBounds(weekDate);
    const year = weekDate.getFullYear();
    const quarter = Math.ceil((weekDate.getMonth() + 1) / 3);

    // Activities assigned to this user due in the selected week
    const { data: rawActivities, error: actErr } = await supabase
      .from("performance_activities")
      .select(`
        *,
        goal:performance_goals!goal_id ( id, title, department_id, year, quarter ),
        assignee:user_profiles!assigned_to ( full_name, email ),
        submission:activity_submissions (
          *,
          attachments:activity_attachments ( * )
        )
      `)
      .eq("assigned_to", userId)
      .gte("due_date", start.toISOString().split("T")[0])
      .lte("due_date", end.toISOString().split("T")[0]);

    if (actErr) { setError(actErr.message); setLoading(false); return; }

    const enriched: ActivityWithStatus[] = (rawActivities ?? []).map(
      (act: Record<string, unknown>) => {
        const submission = (act.submission as { id: string; activity_id: string; submitted_by: string; description: string; submitted_at: string; attachments: { id: string; submission_id: string; file_name: string; file_size: number; storage_path: string; uploaded_at: string }[] } | null) ?? null;
        return {
          ...(act as { id: string; goal_id: string; title: string; assigned_to: string; due_date: string; created_by: string; created_at: string; assignee: { full_name: string; email: string } }),
          status: computeActivityStatus(
            act as { id: string; goal_id: string; title: string; assigned_to: string; due_date: string; created_by: string; created_at: string },
            submission
          ),
          submission: submission ? { id: submission.id, activity_id: submission.activity_id, submitted_by: submission.submitted_by, description: submission.description, submitted_at: submission.submitted_at } : null,
          attachments: submission?.attachments ?? [],
        };
      }
    );

    // Set the first goal title for the banner
    const firstGoal = rawActivities?.[0]?.goal as Record<string, string> | null;
    setGoalTitle(firstGoal?.title ?? null);

    // Compute dept progress for the quarter banner
    const { data: allDeptActs } = await supabase
      .from("performance_activities")
      .select(`
        id, due_date, goal:performance_goals!goal_id ( department_id, year, quarter ),
        submission:activity_submissions ( id )
      `)
      .eq("goal.department_id", ud.department_id)
      .eq("goal.year", year)
      .eq("goal.quarter", quarter);

    const deptTotal = (allDeptActs ?? []).length;
    const deptDone = (allDeptActs ?? []).filter(
      (a: Record<string, unknown>) => a.submission !== null
    ).length;
    setDeptProgressPct(deptTotal === 0 ? 0 : Math.round((deptDone / deptTotal) * 100));

    setActivities(enriched);
    setLoading(false);
  }, [userId, weekDate]);

  useEffect(() => { load(); }, [load]);

  return { department, goalTitle, deptProgressPct, activities, loading, error, reload: load };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-performance-staff.ts
git commit -m "feat: add staff performance data hook"
```

---

## Task 13: Proof of Work Modal

**Files:**
- Create: `src/components/performance/proof-of-work-modal.tsx`

- [ ] **Step 1: Create the modal**

```tsx
// src/components/performance/proof-of-work-modal.tsx
"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, X } from "lucide-react";

interface ProofOfWorkModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  activityId: string;
  activityTitle: string;
  submittedBy: string;
  departmentId: string;
  goalId: string;
}

export function ProofOfWorkModal({
  open,
  onClose,
  onSubmitted,
  activityId,
  activityTitle,
  submittedBy,
  departmentId,
  goalId,
}: ProofOfWorkModalProps) {
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;

    setSaving(true);
    const supabase = createClient();

    // 1. Create submission
    const { data: submission, error: subErr } = await supabase
      .from("activity_submissions")
      .insert({
        activity_id: activityId,
        submitted_by: submittedBy,
        description: description.trim(),
      })
      .select()
      .single();

    if (subErr) {
      toast.error("Failed to submit: " + subErr.message);
      setSaving(false);
      return;
    }

    // 2. Upload attachments
    for (const file of files) {
      const storagePath = `${departmentId}/${goalId}/${activityId}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("performance-attachments")
        .upload(storagePath, file);

      if (uploadErr) {
        toast.error(`Failed to upload ${file.name}: ` + uploadErr.message);
        continue;
      }

      await supabase.from("activity_attachments").insert({
        submission_id: submission.id,
        file_name: file.name,
        file_size: file.size,
        storage_path: storagePath,
      });
    }

    toast.success("Activity marked as done");
    setDescription("");
    setFiles([]);
    onSubmitted();
    onClose();
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as Done</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1 line-clamp-2">
          {activityTitle}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="proof-desc">What did you do? *</Label>
            <Textarea
              id="proof-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe what you completed, any blockers you encountered, and outcomes…"
              required
            />
          </div>

          {/* File attachments */}
          <div className="space-y-2">
            <Label>Attachments (optional)</Label>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-3 py-1.5"
                  >
                    <span className="truncate max-w-[80%]">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-sm text-[#6B2D7B] hover:underline"
            >
              <Paperclip className="size-4" />
              Attach files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !description.trim()}
              className="bg-[#5BBF3A] hover:bg-[#4da830] text-white"
            >
              {saving ? "Submitting…" : "Mark as Done"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/performance/proof-of-work-modal.tsx
git commit -m "feat: add proof of work modal (description + file upload)"
```

---

## Task 14: Staff View Components

**Files:**
- Create: `src/components/performance/week-navigator.tsx`
- Create: `src/components/performance/activity-card.tsx`
- Create: `src/components/performance/staff-dashboard.tsx`

- [ ] **Step 1: Create `week-navigator.tsx`**

```tsx
// src/components/performance/week-navigator.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface WeekNavigatorProps {
  weekDate: Date;
  onChange: (d: Date) => void;
}

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  const isThisWeek = (() => {
    const now = new Date();
    const nowMon = new Date(now);
    nowMon.setDate(now.getDate() + (now.getDay() === 0 ? -6 : 1 - now.getDay()));
    nowMon.setHours(0, 0, 0, 0);
    mon.setHours(0, 0, 0, 0);
    return mon.getTime() === nowMon.getTime();
  })();

  return isThisWeek ? `This week (${fmt(mon)} – ${fmt(sun)})` : `${fmt(mon)} – ${fmt(sun)}`;
}

export function WeekNavigator({ weekDate, onChange }: WeekNavigatorProps) {
  function shift(days: number) {
    const d = new Date(weekDate);
    d.setDate(d.getDate() + days);
    onChange(d);
  }

  const isFuture = (() => {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    return weekDate >= nextWeek;
  })();

  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-white px-4 py-3">
      <button
        onClick={() => shift(-7)}
        className="size-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="text-sm font-medium">{getWeekLabel(weekDate)}</span>
      <button
        onClick={() => shift(7)}
        disabled={isFuture}
        className="size-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors disabled:opacity-30"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `activity-card.tsx`**

```tsx
// src/components/performance/activity-card.tsx
"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProofOfWorkModal } from "./proof-of-work-modal";
import type { ActivityWithStatus } from "@/lib/types";

interface ActivityCardProps {
  activity: ActivityWithStatus;
  currentUserId: string;
  departmentId: string;
  onReload: () => void;
}

export function ActivityCard({
  activity,
  currentUserId,
  departmentId,
  onReload,
}: ActivityCardProps) {
  const [expanded, setExpanded] = useState(activity.status === "overdue");
  const [proofOpen, setProofOpen] = useState(false);

  const dueLabel = new Date(activity.due_date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  const borderClass =
    activity.status === "overdue"
      ? "border-red-300 bg-red-50"
      : activity.status === "done"
      ? "border-green-200 bg-green-50/30"
      : "border-border/60 bg-white";

  return (
    <div className={`rounded-xl border p-4 ${borderClass}`}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {activity.status === "done" ? (
            <CheckCircle2 className="size-5 text-green-500" />
          ) : activity.status === "overdue" ? (
            <Clock className="size-5 text-red-500" />
          ) : (
            <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
          )}
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              activity.status === "done"
                ? "line-through text-muted-foreground"
                : "text-foreground"
            }`}
          >
            {activity.title}
          </p>
          <p
            className={`text-xs mt-0.5 ${
              activity.status === "overdue"
                ? "text-red-600 font-medium"
                : "text-muted-foreground"
            }`}
          >
            Due {dueLabel}
            {activity.status === "overdue" && " — OVERDUE"}
          </p>
        </div>

        {/* Expand toggle (for done activities) */}
        {activity.status === "done" && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-muted-foreground"
          >
            {expanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>
        )}
      </div>

      {/* Done: proof summary (expandable) */}
      {activity.status === "done" && expanded && activity.submission && (
        <div className="mt-3 ml-8 space-y-2">
          <p className="text-xs text-muted-foreground">
            Submitted{" "}
            {new Date(activity.submission.submitted_at).toLocaleDateString(
              "en-GB",
              { day: "numeric", month: "short", year: "numeric" }
            )}
          </p>
          <p className="text-sm text-foreground">{activity.submission.description}</p>
          {activity.attachments.length > 0 && (
            <div className="space-y-1">
              {activity.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 text-xs text-[#6B2D7B]"
                >
                  <Paperclip className="size-3" />
                  {att.file_name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending / Overdue: action buttons */}
      {(activity.status === "pending" || activity.status === "overdue") && (
        <div className="mt-3 ml-8">
          <Button
            size="sm"
            className="h-9 min-w-[120px] bg-[#5BBF3A] hover:bg-[#4da830] text-white"
            onClick={() => setProofOpen(true)}
          >
            Mark as Done
          </Button>
        </div>
      )}

      <ProofOfWorkModal
        open={proofOpen}
        onClose={() => setProofOpen(false)}
        onSubmitted={onReload}
        activityId={activity.id}
        activityTitle={activity.title}
        submittedBy={currentUserId}
        departmentId={departmentId}
        goalId={activity.goal_id}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create `staff-dashboard.tsx`**

```tsx
// src/components/performance/staff-dashboard.tsx
"use client";

import { useState } from "react";
import { WeekNavigator } from "./week-navigator";
import { ActivityCard } from "./activity-card";
import { usePerformanceStaff } from "@/hooks/use-performance-staff";
import { useUser } from "@/hooks/use-user";

export function StaffDashboard() {
  const { user, loading: userLoading } = useUser();
  const [weekDate, setWeekDate] = useState(new Date());

  const { department, goalTitle, deptProgressPct, activities, loading, error, reload } =
    usePerformanceStaff(user?.id ?? "", weekDate);

  if (userLoading || loading) {
    return (
      <div className="space-y-4">
        <div className="h-14 rounded-xl bg-muted animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const done = activities.filter((a) => a.status === "done").length;
  const overdue = activities.filter((a) => a.status === "overdue").length;
  const pending = activities.filter((a) => a.status === "pending").length;
  const myPct =
    activities.length === 0 ? 0 : Math.round((done / activities.length) * 100);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Performance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {user?.full_name} · {department?.name ?? "No department"}
        </p>
      </div>

      {/* Personal summary strip */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: "Done", value: done, color: "text-green-600" },
          { label: "Pending", value: pending, color: "text-muted-foreground" },
          { label: "Overdue", value: overdue, color: "text-red-600" },
          { label: "My %", value: `${myPct}%`, color: "text-[#6B2D7B]" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border/60 bg-white py-3"
          >
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Week navigator */}
      <WeekNavigator weekDate={weekDate} onChange={setWeekDate} />

      {/* Dept goal banner */}
      {goalTitle && (
        <div className="rounded-xl border border-[#6B2D7B]/20 bg-purple-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6B2D7B] mb-1">
            Department Goal
          </p>
          <p className="text-sm font-medium text-foreground">{goalTitle}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white border border-[#6B2D7B]/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#5BBF3A]"
                style={{ width: `${deptProgressPct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              Dept {deptProgressPct}%
            </span>
          </div>
        </div>
      )}

      {/* Activity list */}
      {activities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No activities due this week.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Overdue first */}
          {activities
            .filter((a) => a.status === "overdue")
            .map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                currentUserId={user?.id ?? ""}
                departmentId={department?.id ?? ""}
                onReload={reload}
              />
            ))}
          {/* Then pending */}
          {activities
            .filter((a) => a.status === "pending")
            .map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                currentUserId={user?.id ?? ""}
                departmentId={department?.id ?? ""}
                onReload={reload}
              />
            ))}
          {/* Then done */}
          {activities
            .filter((a) => a.status === "done")
            .map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                currentUserId={user?.id ?? ""}
                departmentId={department?.id ?? ""}
                onReload={reload}
              />
            ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/performance/week-navigator.tsx src/components/performance/activity-card.tsx src/components/performance/staff-dashboard.tsx
git commit -m "feat: add staff view components (week navigator, activity cards, dashboard)"
```

---

## Task 15: Staff Page

**Files:**
- Create: `src/app/(dashboard)/performance/me/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/app/(dashboard)/performance/me/page.tsx
import { StaffDashboard } from "@/components/performance/staff-dashboard";

export default function StaffPerformancePage() {
  return <StaffDashboard />;
}
```

- [ ] **Step 2: Verify in browser**

- Navigate to `/performance/me`
- Should show personal summary strip, week navigator, and activity list
- Navigate to previous weeks using the chevron buttons

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/performance/me/page.tsx
git commit -m "feat: add staff performance page"
```

---

## Task 16: Mobile Bottom Navigation

**Files:**
- Create: `src/components/layout/bottom-nav.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create `bottom-nav.tsx`**

```tsx
// src/components/layout/bottom-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Target,
  ClipboardEdit,
  Settings,
} from "lucide-react";

const BOTTOM_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Programs", href: "/programs/enterprise-spotlight", icon: BarChart3 },
  { label: "Performance", href: "/performance", icon: Target },
  { label: "Data Entry", href: "/data-entry", icon: ClipboardEdit },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white lg:hidden">
      <div className="flex">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors ${
                isActive
                  ? "text-[#6B2D7B]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="size-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <span className="absolute top-0 left-0 right-0 h-0.5 bg-[#6B2D7B]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Update `src/app/(dashboard)/layout.tsx`**

```tsx
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarProvider } from "@/lib/sidebar-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="lg:ml-64 transition-all duration-300">
          <Topbar />
          <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10 max-w-[1440px] mx-auto pb-20 lg:pb-10">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </SidebarProvider>
  );
}
```

> Note: `pb-20 lg:pb-10` adds bottom padding on mobile so content doesn't sit behind the nav bar.

- [ ] **Step 3: Verify on mobile viewport**

Open DevTools → toggle mobile viewport (375px width). The bottom nav bar should appear with 5 items. The active item should be highlighted in purple.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/bottom-nav.tsx src/app/(dashboard)/layout.tsx
git commit -m "feat: add mobile bottom navigation bar"
```

---

## Task 17: End-to-End Verification

No code changes — this task verifies the full feature works together.

- [ ] **Step 1: Run the dev server**

```bash
cd C:/Users/ishma/Desktop/springboard-mis/.claude/worktrees/great-chatterjee
npm run dev
```

- [ ] **Step 2: Verify ED flow**
  1. Log in as Admin → navigate to `/performance`
  2. Confirm 5 department cards appear
  3. Confirm KPI row shows overall %, on-track/at-risk/overdue counts
  4. Change quarter → cards should refresh
  5. Click a department card → should navigate to `/performance/[id]`

- [ ] **Step 3: Verify Manager flow**
  1. On the manager view, confirm 3 tabs render
  2. Click "Add Goal" → fill in form → confirm goal appears in list
  3. Expand the goal → click "Add activity" → assign to a staff member
  4. Switch to Staff tab → confirm the assigned staff member shows 1 activity

- [ ] **Step 4: Verify Staff flow**
  1. Navigate to `/performance/me`
  2. Confirm week navigator works (previous/next week)
  3. For an activity with pending status: click "Mark as Done" → fill description → submit
  4. Confirm activity now shows done state with proof chip
  5. Expand it to verify description is visible

- [ ] **Step 5: Verify mobile bottom nav**
  1. Open DevTools → set viewport to 375px
  2. Confirm bottom nav appears with 5 items
  3. Confirm desktop sidebar still shows at lg breakpoint

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete performance management module"
```
