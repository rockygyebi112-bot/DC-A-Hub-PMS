# Data Collection & Internal Tab UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Data Collection dashboard and the Internal tab up to the visual and performance bar of the workspace project page — faster loads, responsive controls, real KPI numbers, and polished task cards.

**Architecture:** Reuse the existing component kit (`PageHeader`, `ProjectMetricCard`, shadcn `Button`/`Tabs`, `AvatarStack`, `Skeleton`). Parallelize serial DB calls. Add `useTransition` pending states to URL-driven controls. No change to RLS, ingestion, the chart engine, the data model, or server actions.

**Tech Stack:** Next.js 15 App Router (RSC), TypeScript, Supabase, Tailwind, shadcn/base-ui components.

**Verification:** This is a presentational change with no new logic units, so there are no new automated tests. Each task is verified by `npx tsc --noEmit` (type safety) and, at the end, a manual dev-server pass. Existing tests under `tests/` exercise `src/lib/*` and are unaffected.

---

### Task 1: Parallelize dashboard page fetches + adopt `PageHeader`

**Files:**
- Modify: `src/app/workspace/projects/[id]/dashboard/page.tsx`

- [ ] **Step 1: Replace the page file contents**

Replace the entire contents of `src/app/workspace/projects/[id]/dashboard/page.tsx` with:

```tsx
import { notFound, redirect } from 'next/navigation';

import { PageHeader } from '@/components/admin/ui/page-header';
import { ProjectIcon } from '@/components/ui/project-icon';
import { DashboardView } from '@/components/evaluations/dashboard-view';
import { ProjectDashboardTabs } from '@/components/evaluations/project-dashboard-tabs';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { getEvaluation, getEvaluationForProject } from '@/lib/evaluations/queries';
import { getWorkspaceProject } from '@/lib/workspace/queries';

export const dynamic = 'force-dynamic';

export default async function StaffDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: projectId } = await params;
  const sp = await searchParams;

  // These three reads are mutually independent — fan them out.
  const [profile, project, evMin] = await Promise.all([
    getCurrentProfile(),
    getWorkspaceProject(projectId),
    getEvaluationForProject(projectId),
  ]);

  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    redirect('/');
  }
  if (!project) notFound();
  if (!evMin) notFound();

  // Depends on evMin.id, so it runs after the fan-out.
  const ev = await getEvaluation(evMin.id);
  if (!ev) notFound();

  const hh = (ev.instruments ?? []).find(
    (i: { kind: string }) => i.kind === 'hh',
  );

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <ProjectIcon name={project.name} seed={project.id} />
            <span>{project.name}</span>
          </span>
        }
        subtitle={`Data Collection · ${project.client?.name ?? 'Client'}`}
        backFallbackHref={`/workspace/projects/${projectId}`}
      />
      <div className="mb-6">
        <ProjectDashboardTabs projectId={projectId} />
      </div>
      {hh ? (
        <DashboardView
          projectId={projectId}
          evaluationId={ev.id}
          instrumentId={hh.id}
          targetN={ev.collection_target_n}
          defaultMode={
            (ev.dashboard_default_mode ?? 'auto') as
              | 'auto'
              | 'progress'
              | 'findings'
          }
          searchParams={sp}
          approvedOnly={false}
          showStaffControls
        />
      ) : (
        <p className="p-6 text-sm text-muted-foreground">
          No instrument configured.
        </p>
      )}
    </>
  );
}
```

Notes:
- The `px-6 pt-6` wrapper is removed — `PageHeader` and the workspace layout already supply page padding (the project page at `src/app/workspace/projects/[id]/page.tsx` uses `PageHeader` with no extra padding wrapper).
- `getCurrentProfile` stays in the `Promise.all`; the role check runs immediately after the await resolves, before any render, so the auth gate is unchanged.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). If `ProjectIcon` import path differs, confirm with `git grep "export function ProjectIcon"` — it lives at `src/components/ui/project-icon.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/workspace/projects/[id]/dashboard/page.tsx
git commit -m "perf: parallelize dashboard fetches, adopt PageHeader"
```

---

### Task 2: Restyle `ProjectDashboardTabs` to match the real `TabsList`

**Files:**
- Modify: `src/components/evaluations/project-dashboard-tabs.tsx`

The current strip is a hand-rolled approximation. Align it with the project page's `TabsList`/`TabsTrigger` look (rounded `bg-muted` container, active trigger gets `bg-background` + shadow).

- [ ] **Step 1: Replace the component body**

Replace the entire contents of `src/components/evaluations/project-dashboard-tabs.tsx` with:

```tsx
import Link from 'next/link';
import {
  BarChart3,
  CalendarDays,
  Columns3,
  Layers,
  ListChecks,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const triggerBase =
  'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all [&_svg]:size-4 [&_svg]:shrink-0';
const triggerInactive =
  'text-muted-foreground hover:text-foreground';
const triggerActive =
  'bg-background text-foreground shadow-sm';

/**
 * Tab strip on the project's Data Collection dashboard route. The four
 * Phases/Board/List/Timeline entries link back to the project page; Data
 * Collection shows the active style. Styled to match the in-page `TabsList`.
 */
export function ProjectDashboardTabs({ projectId }: { projectId: string }) {
  const back = `/workspace/projects/${projectId}`;
  return (
    <div className="inline-flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-[3px] sm:w-auto">
      <Link href={back} className={cn(triggerBase, triggerInactive)}>
        <Layers />
        Phases
      </Link>
      <Link href={back} className={cn(triggerBase, triggerInactive)}>
        <Columns3 />
        Board
      </Link>
      <Link href={back} className={cn(triggerBase, triggerInactive)}>
        <ListChecks />
        List
      </Link>
      <Link href={back} className={cn(triggerBase, triggerInactive)}>
        <CalendarDays />
        Timeline
      </Link>
      <span
        className={cn(triggerBase, triggerActive)}
        aria-current="page"
      >
        <BarChart3 />
        Data Collection
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/evaluations/project-dashboard-tabs.tsx
git commit -m "style: align Data Collection tab strip with TabsList"
```

---

### Task 3: Parallelize `DashboardView`, remove the duplicate header

**Files:**
- Modify: `src/components/evaluations/dashboard-view.tsx`

The component runs three independent awaits serially and renders its own `<h1>`. After this task its `<header>` becomes a controls-only row (no title); the title now comes from the page `PageHeader`. The KPI numbers (approved/target) move into the cards in Task 4 — but `approvedCount` is computed here and threaded into `ProgressMode`.

- [ ] **Step 1: Parallelize the three reads**

In `src/components/evaluations/dashboard-view.tsx`, the body currently does
(roughly lines 26, 54-58, 77-80):

```tsx
const cfg = await getActiveDashboardSpec(props.evaluationId);
// ...later...
const sb = await createClient();
const { count: approvedCount } = await sb
  .from('evaluation_responses')
  .select('id', { count: 'exact', head: true })
  .eq('instrument_id', props.instrumentId)
  .eq('qc_status', 'approved');
// ...later...
const { data: filterRows } = await sb
  .from('evaluation_responses')
  .select('region, district, community')
  .eq('instrument_id', props.instrumentId);
```

`cfg` is needed before the early-return guard, so fetch the Supabase client and
`cfg` first, then fan out the two queries. Replace the `const cfg = await getActiveDashboardSpec(...)` line and the `if (!cfg)` block start with:

```tsx
const sb = await createClient();
const cfg = await getActiveDashboardSpec(props.evaluationId);
if (!cfg) {
```

(the `if (!cfg)` early-return body is unchanged.)

Then **delete** the later standalone `const sb = await createClient();` line and the two separate `await` query blocks, and immediately after `const spec = DashboardSpec.parse(cfg.spec);` insert:

```tsx
  const [approvedRes, filterRowsRes] = await Promise.all([
    sb
      .from('evaluation_responses')
      .select('id', { count: 'exact', head: true })
      .eq('instrument_id', props.instrumentId)
      .eq('qc_status', 'approved'),
    sb
      .from('evaluation_responses')
      .select('region, district, community')
      .eq('instrument_id', props.instrumentId),
  ]);
  const approvedCount = approvedRes.count;
  const filterRows = filterRowsRes.data;
```

The rest of the function (the `filters` object, `targetN`, `collectionPct`, `autoMode`, `distinctValues`, etc.) already references `approvedCount` and `filterRows` and stays as-is — just ensure the `filters` object construction now appears after this block (move the `const filters: FilterState = {...}` assignment down to just before the `return` if a type/order error appears; `filters` has no dependency on these queries so order is free).

- [ ] **Step 2: Remove the duplicate `<h1>` from the header**

Replace the `<header>` block (currently lines ~99-120) with:

```tsx
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {approvedCount ?? 0} approved / {targetN || '—'} target
        </span>
        <div className="flex items-center gap-2">
          {props.showStaffControls && (
            <>
              <SyncNowButton instrumentId={props.instrumentId} />
              <Link
                href={`/workspace/projects/${props.projectId}/responses`}
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                Review responses
              </Link>
            </>
          )}
          <ModeToggle defaultMode={effectiveDefault} />
        </div>
      </header>
```

This drops the `<h1>Evaluation dashboard</h1>` (the page `PageHeader` is now the only title) but keeps the approved/target readout and all controls.

- [ ] **Step 3: Thread `approvedCount` into `ProgressMode`**

Find the `<ProgressMode .../>` usage inside the `<Suspense>` block and add the `approvedCount` prop:

```tsx
          <ProgressMode
            targetN={targetN}
            instrumentId={props.instrumentId}
            approvedOnly={props.approvedOnly}
            filters={filters}
            approvedCount={approvedCount ?? 0}
          />
```

(The `ProgressMode` signature gets the new prop in Task 4.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: One expected error — `ProgressMode` does not yet accept `approvedCount`. That is fixed in Task 4. If any *other* error appears, fix it before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/components/evaluations/dashboard-view.tsx
git commit -m "perf: parallelize DashboardView reads, drop duplicate header"
```

---

### Task 4: Wire up the KPI tiles with real numbers

**Files:**
- Modify: `src/components/evaluations/dashboard-view.tsx`
- Delete: `src/components/evaluations/kpi-tile.tsx`

`ProgressMode` currently renders three `KpiTile`s with hardcoded `value="—"`.
Replace with real counts using `ProjectMetricCard`.

- [ ] **Step 1: Update imports in `dashboard-view.tsx`**

Remove the `KpiTile` import line:

```tsx
import { KpiTile } from './kpi-tile';
```

Add these imports near the other imports:

```tsx
import { ProjectMetricCard } from '@/app/workspace/projects/[id]/_components/project-metric-card';
import { ProjectProgress } from '@/components/workspace/project-progress';
```

- [ ] **Step 2: Replace the `ProgressMode` function**

Replace the entire `ProgressMode` function (currently lines ~182-231) with:

```tsx
async function ProgressMode(props: {
  instrumentId: string;
  approvedOnly: boolean;
  targetN: number;
  filters: FilterState;
  approvedCount: number;
}) {
  // Two independent count/select reads for the remaining KPI tiles.
  const sb = await createClient();
  const [pendingRes, districtRes] = await Promise.all([
    sb
      .from('evaluation_responses')
      .select('id', { count: 'exact', head: true })
      .eq('instrument_id', props.instrumentId)
      .eq('qc_status', 'pending'),
    sb
      .from('evaluation_responses')
      .select('district')
      .eq('instrument_id', props.instrumentId),
  ]);
  const pendingCount = pendingRes.count ?? 0;
  const districtsActive = new Set(
    (districtRes.data ?? [])
      .map((r: { district: string | null }) => r.district)
      .filter((d): d is string => Boolean(d)),
  ).size;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <ProjectMetricCard title="Approved">
          <ProjectProgress done={props.approvedCount} total={props.targetN} />
        </ProjectMetricCard>
        <ProjectMetricCard title="Awaiting QC">
          <p className="font-heading text-2xl font-semibold tabular-nums">
            {pendingCount}
          </p>
        </ProjectMetricCard>
        <ProjectMetricCard title="Districts active">
          <p className="font-heading text-2xl font-semibold tabular-nums">
            {districtsActive}
          </p>
        </ProjectMetricCard>
      </div>
      <ChartEngine
        entry={{
          type: 'choropleth',
          field: '_progress',
          title: 'Regional % of target',
        }}
        instrumentId={props.instrumentId}
        approvedOnly={props.approvedOnly}
        filters={props.filters}
        targetN={props.targetN}
      />
      <ChartEngine
        entry={{
          type: 'trend_line',
          field: '_submitted_at',
          title: 'Daily submissions (last 30 days)',
        }}
        instrumentId={props.instrumentId}
        approvedOnly={props.approvedOnly}
        filters={props.filters}
      />
      <ChartEngine
        entry={{
          type: 'progress_bars',
          field: '_progress',
          title: 'Per-region progress vs target',
        }}
        instrumentId={props.instrumentId}
        approvedOnly={props.approvedOnly}
        filters={props.filters}
        targetN={props.targetN}
      />
    </section>
  );
}
```

Notes:
- `ProjectProgress` (from `src/components/workspace/project-progress.tsx`) renders a labelled progress bar from `done`/`total` — confirm its prop names with `git grep "function ProjectProgress"`; the project page calls it as `<ProjectProgress done={...} total={...} />`.
- The `DashboardModeSkeleton` already renders a 3-up tile grid, so the loading state still matches.

- [ ] **Step 3: Delete the now-orphan `KpiTile`**

`KpiTile` was only imported by `dashboard-view.tsx` (verified: `git grep -l KpiTile` lists only `kpi-tile.tsx` and `dashboard-view.tsx`). Delete it:

```bash
git rm src/components/evaluations/kpi-tile.tsx
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (the Task 3 expected error is now resolved).

- [ ] **Step 5: Commit**

```bash
git add src/components/evaluations/dashboard-view.tsx
git commit -m "feat: wire up dashboard KPI tiles with real counts"
```

---

### Task 5: Add `useTransition` pending states to `FilterBar` and `ModeToggle`

**Files:**
- Modify: `src/components/evaluations/filter-bar.tsx`
- Modify: `src/components/evaluations/mode-toggle.tsx`

Both call `router.push()` with no feedback. Wrap in `useTransition` and dim/disable the controls while pending.

- [ ] **Step 1: Update `filter-bar.tsx`**

Replace the entire contents of `src/components/evaluations/filter-bar.tsx` with:

```tsx
'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function FilterBar(props: {
  regions: string[];
  districts: string[];
  communities: string[];
  socoExposureOptions: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === 'all' || value === 'All') next.delete(name);
    else next.set(name, value);
    startTransition(() => {
      router.push(`?${next.toString()}`);
    });
  }

  const region = params.get('region') || 'all';
  const district = params.get('district') || 'all';
  const community = params.get('community') || 'all';
  const gender = params.get('gender') ?? 'all';
  const exposure = params.get('soco_exposure') ?? 'All';

  return (
    <div
      data-pending={isPending ? '' : undefined}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm transition-opacity data-[pending]:pointer-events-none data-[pending]:opacity-50"
    >
      <Select
        value={region}
        onValueChange={(v) => setParam('region', v ?? 'all')}
        disabled={isPending}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All regions</SelectItem>
          {props.regions.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={district}
        onValueChange={(v) => setParam('district', v ?? 'all')}
        disabled={isPending}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All districts</SelectItem>
          {props.districts.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={community}
        onValueChange={(v) => setParam('community', v ?? 'all')}
        disabled={isPending}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All communities</SelectItem>
          {props.communities.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={gender}
        onValueChange={(v) => setParam('gender', v ?? 'all')}
        disabled={isPending}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All genders</SelectItem>
          <SelectItem value="female">Female</SelectItem>
          <SelectItem value="male">Male</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={exposure}
        onValueChange={(v) => setParam('soco_exposure', v ?? 'All')}
        disabled={isPending}
      >
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.socoExposureOptions.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

If the `Select` component does not accept a `disabled` prop, the
`data-[pending]` opacity + `pointer-events-none` on the wrapper already blocks
interaction — in that case remove the five `disabled={isPending}` lines. Verify
with `git grep "disabled" src/components/ui/select.tsx`.

- [ ] **Step 2: Update `mode-toggle.tsx`**

Replace the entire contents of `src/components/evaluations/mode-toggle.tsx` with:

```tsx
'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function ModeToggle({
  defaultMode,
}: {
  defaultMode: 'progress' | 'findings';
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const mode =
    (params.get('mode') as 'progress' | 'findings' | null) ?? defaultMode;

  function setMode(m: 'progress' | 'findings') {
    const next = new URLSearchParams(params.toString());
    next.set('mode', m);
    startTransition(() => {
      router.push(`?${next.toString()}`);
    });
  }

  return (
    <div
      data-pending={isPending ? '' : undefined}
      className="inline-flex rounded-lg border border-border p-1 text-sm transition-opacity data-[pending]:opacity-50"
    >
      <button
        type="button"
        disabled={isPending}
        onClick={() => setMode('progress')}
        className={`rounded px-3 py-1 disabled:cursor-not-allowed ${
          mode === 'progress' ? 'bg-primary text-primary-foreground' : ''
        }`}
      >
        Progress
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setMode('findings')}
        className={`rounded px-3 py-1 disabled:cursor-not-allowed ${
          mode === 'findings' ? 'bg-primary text-primary-foreground' : ''
        }`}
      >
        Findings
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/evaluations/filter-bar.tsx src/components/evaluations/mode-toggle.tsx
git commit -m "feat: add pending states to dashboard filter and mode controls"
```

---

### Task 6: Internal page — `PageHeader`, `<Link>` filters, status filter row

**Files:**
- Modify: `src/app/workspace/internal/page.tsx`

- [ ] **Step 1: Replace the page file contents**

Replace the entire contents of `src/app/workspace/internal/page.tsx` with:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { listAreas, listTasks } from '@/lib/internal/queries';
import { TaskList } from '@/components/internal/task-list';
import { NewTaskForm } from '@/components/internal/new-task-form';
import { PageHeader } from '@/components/admin/ui/page-header';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

export default async function InternalWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; status?: string; project?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    redirect('/');
  }

  const params = await searchParams;
  const [areas, tasks] = await Promise.all([
    listAreas(),
    listTasks({
      areaId: params.area,
      status: params.status,
      projectId: params.project,
    }),
  ]);

  // Build a filter href that mutates one param and preserves the rest.
  function filterHref(patch: { area?: string; status?: string }) {
    const next = new URLSearchParams();
    const area = 'area' in patch ? patch.area : params.area;
    const status = 'status' in patch ? patch.status : params.status;
    if (area) next.set('area', area);
    if (status) next.set('status', status);
    if (params.project) next.set('project', params.project);
    const qs = next.toString();
    return qs ? `/workspace/internal?${qs}` : '/workspace/internal';
  }

  return (
    <>
      <PageHeader
        title="Internal workspace"
        subtitle="DC&A Hub internal tasks. Not visible to clients."
        backFallbackHref="/workspace"
        action={<NewTaskForm areas={areas} />}
      />

      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-2 text-sm">
          <FilterPill
            href={filterHref({ area: undefined })}
            label="All areas"
            active={!params.area}
          />
          {areas.map((a) => (
            <FilterPill
              key={a.id}
              href={filterHref({ area: a.id })}
              label={a.name}
              active={params.area === a.id}
              color={a.color ?? undefined}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <FilterPill
            href={filterHref({ status: undefined })}
            label="All statuses"
            active={!params.status}
          />
          {STATUS_FILTERS.map((s) => (
            <FilterPill
              key={s.value}
              href={filterHref({ status: s.value })}
              label={s.label}
              active={params.status === s.value}
            />
          ))}
        </div>
      </div>

      <TaskList tasks={tasks} areas={areas} />
    </>
  );
}

function FilterPill({
  href,
  label,
  active,
  color,
}: {
  href: string;
  label: string;
  active: boolean;
  color?: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-muted'
      }`}
      style={color && !active ? { borderColor: color, color } : undefined}
    >
      {label}
    </Link>
  );
}
```

Notes:
- The `<main className="space-y-6 p-6">` wrapper is dropped — the workspace layout supplies page padding, matching how the project page uses `PageHeader` at the top level.
- `filterHref` mutates only the patched param; `area` and `status` compose, and `project` (if present) is always preserved.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/workspace/internal/page.tsx
git commit -m "feat: PageHeader, client-side filters, and status filter for Internal tab"
```

---

### Task 7: Internal loading skeleton

**Files:**
- Modify: `src/app/workspace/internal/loading.tsx`

- [ ] **Step 1: Replace the loading file contents**

Replace the entire contents of `src/app/workspace/internal/loading.tsx` with:

```tsx
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-56" />
        <SkeletonText width="22rem" />
      </div>
      <div className="mb-2 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-md" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/workspace/internal/loading.tsx
git commit -m "style: real loading skeleton for Internal tab"
```

---

### Task 8: Polish `TaskCard` — formatted dates, avatars, priority badge

**Files:**
- Modify: `src/components/internal/task-card.tsx`

- [ ] **Step 1: Replace the component file contents**

Replace the entire contents of `src/components/internal/task-card.tsx` with:

```tsx
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';

// Shape mirrors `InternalTaskWithAssignees` from `@/lib/internal/queries`:
// the DB column is plain text (no enum) so `status`/`priority` come back as
// `string`, and the two-step assignee hydration yields
// `{ user_id, profile: {...} | null }` per row.
export type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority?: string | null;
  due_date?: string | null;
  assignees?:
    | {
        user_id: string;
        profile: {
          user_id: string;
          full_name: string | null;
          avatar_url: string | null;
        } | null;
      }[]
    | null;
};

const statusStyle: Record<string, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  blocked: 'bg-red-500/15 text-red-600 dark:text-red-400',
  done: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};

const priorityVariant: Record<
  string,
  'neutral' | 'info' | 'warning' | 'destructive'
> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'destructive',
};

function formatDue(iso: string): string {
  // ISO date (YYYY-MM-DD) — parse as local to avoid TZ off-by-one.
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function TaskCard({ task }: { task: TaskRow }) {
  const pillClass =
    statusStyle[task.status] ?? 'bg-muted text-muted-foreground';
  const assignees = (task.assignees ?? []).filter((a) => a.profile);
  const visible = assignees.slice(0, 3);
  const overflow = assignees.length - visible.length;

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const overdue =
    !!task.due_date && task.status !== 'done' && task.due_date < todayIso;

  return (
    <Link
      href={`/workspace/internal/${task.id}`}
      className="block rounded-md border border-border bg-card p-3 shadow-sm transition-colors hover:border-foreground/30"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{task.title}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${pillClass}`}
        >
          {task.status.replace('_', ' ')}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${
              overdue ? 'font-medium text-destructive' : 'text-muted-foreground'
            }`}
          >
            {task.due_date ? formatDue(task.due_date) : 'No due date'}
          </span>
          {task.priority && priorityVariant[task.priority] && (
            <Badge variant={priorityVariant[task.priority]}>
              {task.priority}
            </Badge>
          )}
        </div>
        {assignees.length > 0 ? (
          <div className="flex items-center -space-x-2">
            {visible.map((a) =>
              a.profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={a.user_id}
                  src={a.profile.avatar_url}
                  alt={a.profile.full_name ?? ''}
                  className="size-6 rounded-full object-cover ring-2 ring-card"
                />
              ) : (
                <span
                  key={a.user_id}
                  className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground ring-2 ring-card"
                >
                  {initials(a.profile?.full_name ?? null)}
                </span>
              ),
            )}
            {overflow > 0 && (
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground ring-2 ring-card">
                +{overflow}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
      </div>
    </Link>
  );
}
```

Notes:
- A plain `<img>` is used (not `next/image`) with an eslint-disable, because
  `avatar_url` is an arbitrary external URL and these are tiny 24px thumbnails —
  consistent with avoiding `next/image` remote-pattern config for one surface.
  If `git grep "next/image" src/components/internal` shows the codebase already
  configured remote patterns, prefer `next/image` instead.
- `Badge` accepts `variant` — confirmed values in `src/components/ui/badge.tsx`:
  `neutral | info | success | warning | destructive | outline`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Lint the changed files**

Run: `npx eslint src/components/internal/task-card.tsx`
Expected: PASS (the `<img>` is covered by the inline disable comment).

- [ ] **Step 4: Commit**

```bash
git add src/components/internal/task-card.tsx
git commit -m "feat: polish internal TaskCard with dates, avatars, priority"
```

---

### Task 9: Full build + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: PASS — no type errors, no failed page compilation.

- [ ] **Step 2: Run the existing test suite**

Run: `npm test`
Expected: PASS — these tests exercise `src/lib/*` and are unaffected; this confirms no regression.

- [ ] **Step 3: Manual dev-server pass**

Run: `npm run dev`, then in a browser (logged in as a staff or admin user):

Data Collection dashboard (`/workspace/projects/<SOCO project id>/dashboard`):
- [ ] Page shows exactly one header (project name via `PageHeader`); no second "Evaluation dashboard" heading.
- [ ] The tab strip reads as tabs with "Data Collection" active.
- [ ] In Progress mode the three KPI cards show real numbers (Approved progress bar, Awaiting QC count, Districts active count) — not `—`.
- [ ] Changing a filter `Select` or clicking the mode toggle dims the control row immediately (pending state) before the charts refresh.

Internal tab (`/workspace/internal`):
- [ ] Header uses `PageHeader`; "+ New task" sits in the header action slot.
- [ ] Clicking an area or status pill navigates without a full-page reload (no white flash); the loading skeleton appears briefly.
- [ ] Area and status filters compose (e.g. select an area, then a status — both stay active).
- [ ] Task cards show a formatted due date ("May 22"), overdue dates in red, assignee avatars (or initials), and a priority badge when set.

- [ ] **Step 4: Commit any fixes**

If the manual pass surfaces issues, fix them and commit with a descriptive message. If everything passes, no commit is needed for this task.

---

## Self-Review

- **Spec coverage:** A1 perf → Tasks 1, 3; A2 layout → Tasks 1, 2, 3; A3 KPIs → Task 4; A4 responsiveness → Task 5; B1 shell → Task 6; B2 filters → Task 6; B3 skeleton → Task 7; B4 card polish → Task 8. All spec sections mapped.
- **Placeholders:** none — every code step shows full file or full block contents.
- **Type consistency:** `ProgressMode` gains `approvedCount: number` in Task 3 (call site) and Task 4 (signature) — consistent. `approvedCount`/`filterRows` renamed-from-destructure in Task 3 match their existing downstream uses.
- **Risk note:** Tasks 3→4 leave one intentional, documented intermediate typecheck error (`ProgressMode` prop), resolved within Task 4.
