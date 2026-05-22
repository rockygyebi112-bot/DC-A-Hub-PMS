# Data Collection & Internal Tab UI Redesign — Design

**Date:** 2026-05-22
**Status:** Approved — ready for implementation planning

## Problem

Two workspace surfaces are visibly below the quality bar of the rest of the
app:

- **The Data Collection dashboard** (`/workspace/projects/[id]/dashboard`)
  loads slowly, its filter and mode controls feel frozen when clicked, it
  renders two stacked `<h1>`s, and its KPI tiles are hardcoded `—`
  placeholders.
- **The Internal tab** (`/workspace/internal`) uses raw `<a>` tags for its
  filters (full-page reloads), has only a bare text "Loading…" state, exposes
  no UI for the status filter its query already supports, and renders raw ISO
  dates and a plain "N assigned" count instead of avatars.

The rest of the app already has a polished, consistent kit. The workspace
project page (`src/app/workspace/projects/[id]/page.tsx`) is the gold
standard: `PageHeader`, `SectionCard`, `ProjectMetricCard`, `StatusPill`, and
shadcn `Button`/`Tabs`/`Input`. This redesign brings both surfaces up to that
bar — it is a consistency and polish change, not a new visual language.

## Goals

- Data Collection dashboard loads faster and its controls feel responsive.
- Both surfaces visually match the workspace project page.
- The dashboard's KPI tiles show real numbers.
- The Internal tab gets client-side filter navigation, a status filter, a
  proper loading skeleton, and polished task cards.

## Non-goals

- No change to RLS, the Kobo ingestion pipeline, the chart aggregation/engine,
  the data model, or any server action.
- No redesign of the chart visualisations themselves.
- No new evaluation features (multiple evaluations per project, etc.).

## Approach

Anchor both redesigns to the existing workspace project page component kit
(`PageHeader`, `SectionCard`, `ProjectMetricCard`, shadcn `Button`/`Tabs`).
Reusing these gives consistent spacing, dark-mode, and responsive behaviour
for free, and keeps the diff focused on the two affected surfaces.

## Surface A — Data Collection dashboard

### A1. Performance

`src/app/workspace/projects/[id]/dashboard/page.tsx` currently runs four DB
calls strictly sequentially. Collapse the independent ones:

```
Promise.all([ getCurrentProfile(), getWorkspaceProject(id), getEvaluationForProject(id) ])
  → then getEvaluation(evMin.id)   // depends on getEvaluationForProject result
```

`getEvaluation` still runs after, because it needs the evaluation id. This
removes ~2 round trips from the critical path.

`src/components/evaluations/dashboard-view.tsx` runs three serial awaits
(`getActiveDashboardSpec`, the approved-count query, the filter-rows query).
These are mutually independent — collapse into one `Promise.all`.

### A2. Layout

- Replace the bare `<h1>{project.name}</h1>` block in `dashboard/page.tsx`
  with `PageHeader` — `ProjectIcon` + project name as title, subtitle
  `"Data Collection · {client name}"`, `backFallbackHref` to the project page.
- The staff controls (`SyncNowButton`, "Review responses" link, `ModeToggle`)
  move into the `PageHeader` `action` slot.
- Delete the duplicate inner `<h1>Evaluation dashboard</h1>` and its
  approved/target `<span>` from `DashboardView`'s header — that information
  moves to the KPI cards (A3). `DashboardView`'s header row is removed; the
  page-level `PageHeader` is the single header.
- Restyle `ProjectDashboardTabs` so the four back-links and the active
  "Data Collection" entry match the real `TabsList`/`TabsTrigger` styling on
  the project page (currently a hand-rolled approximation).
- The routed tab strip stays — Data Collection remains a routed tab-link, per
  the existing project-scoped data collection design.

### A3. KPI tiles — wire up the stubs

`ProgressMode` in `dashboard-view.tsx` currently renders three `KpiTile`s with
hardcoded `value="—"`. Replace with real values, fetched in a single
`Promise.all` of `head: true` count queries against `evaluation_responses`
(filtered by `instrument_id`):

| Tile | Value | Query |
|---|---|---|
| Approved | `approvedCount` / `targetN` | `qc_status = 'approved'` count (already computed in `DashboardView` — pass it down) |
| Awaiting QC | pending count | `qc_status = 'pending'` count |
| Districts active | distinct non-null `district` count | derived from a `select('district')` on the instrument's responses |

The KPI grid uses `ProjectMetricCard` (the project page's metric card) for
visual consistency; the "Approved" card includes a progress bar showing
`approvedCount / targetN`. `KpiTile` is replaced by `ProjectMetricCard` usage
and removed if it has no other consumers (typecheck/knip confirms).

### A4. Responsiveness

`FilterBar` and `ModeToggle` call `router.push()` on every change with no
pending feedback; combined with `force-dynamic` every click triggers a full
server re-render and the control appears frozen.

- Wrap each `router.push` in `useTransition`.
- While `isPending`, dim the control row (reduced opacity) and disable the
  `Select`/toggle triggers so the click visibly registers.
- The dashboard's existing `Suspense key={mode}` skeleton continues to cover
  the chart area; the transition state covers the control row.

## Surface B — Internal tab

### B1. Page shell

`src/app/workspace/internal/page.tsx`: replace the hand-rolled `<header>`
with `PageHeader` — title "Internal workspace", subtitle "DC&A Hub internal
tasks. Not visible to clients.", `NewTaskForm` in the `action` slot.

### B2. Filters

- `FilterPill` switches from raw `<a>` to Next.js `<Link>` — client-side
  navigation, no full document reload.
- **Add the missing status filter.** The page query already accepts
  `?status=`, but no UI sets it. Add a second pill row below the area pills:
  All / Not started / In progress / Blocked / Done. Each pill links with the
  `status` param set, preserving the current `area` param (and vice versa, so
  area + status compose). Pills reuse the `FilterPill` component.

### B3. Loading skeleton

Replace `src/app/workspace/internal/loading.tsx` (currently a single gray
text line) with a skeleton matching the page: a header block, a filter-pill
row, and a responsive grid of placeholder task cards — consistent with
loading states elsewhere in the app.

### B4. Task card polish

`src/components/internal/task-card.tsx`:

- Format `due_date` as a human date (e.g. "May 22"); render it in a
  destructive/red tone when the date is in the past and the task is not
  `done`.
- Replace the "N assigned" text with a small stacked row of assignee avatars
  using `profile.avatar_url` (fallback to initials from `full_name`). The
  query already hydrates these profiles. Cap the visible avatars (e.g. 3) with
  a "+N" overflow chip.
- Add a small priority badge when `priority` is set.

`TaskList` keeps its group-by-area layout; only the card presentation changes.

## Data flow

Unchanged. Every page still resolves the evaluation via
`projectId → getEvaluationForProject → getEvaluation`, and internal tasks via
`listAreas` / `listTasks`. The KPI count queries (A3) are new reads against
`evaluation_responses`, already RLS-scoped by project membership — no new
authorization logic.

## Testing

- Existing evaluation and internal-task unit/integration/RLS tests are
  unaffected — they exercise `src/lib/*`, none of which changes.
- Manual verification:
  - Dashboard: loads without a visible stall; clicking a filter or the mode
    toggle shows an immediate pending state; KPI tiles show real numbers; only
    one page header is visible.
  - Internal tab: clicking an area or status pill navigates client-side (no
    full reload); status pills filter correctly and compose with area;
    skeleton appears on navigation; task cards show formatted dates and
    avatars.

## Risks

| Risk | Mitigation |
|---|---|
| Removing `DashboardView`'s header drops the approved/target readout | The readout is reproduced — and improved — by the "Approved" KPI card. |
| `KpiTile` removal leaves dead imports | Run typecheck + knip; remove the file only if it has no other consumers. |
| Parallelizing `dashboard/page.tsx` changes auth-gate ordering | `getCurrentProfile` stays in the `Promise.all` but the role check runs immediately after the await resolves, before any render — behaviour is unchanged. |
| Status-pill links dropping the `area` param (or vice versa) | Build each pill's href from the current `searchParams`, mutating only its own param. |
