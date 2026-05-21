# Project-Scoped Data Collection — Design

**Date:** 2026-05-21
**Status:** Approved — ready for implementation planning

## Problem

The SOCO Evaluation Dashboard (Part 2) shipped its surfaces behind a global
**"Evaluations"** nav item and a cross-project index (`/workspace/evaluations`,
`/admin/evaluations`). In practice an evaluation belongs to *one* project — the
dashboard for SOCO data collection should live *inside the SOCO project*, the
same way Budget and Team do, not in a global list. As more programmes adopt
data collection, each project that has it should surface a **Data Collection**
tab; projects without it should show nothing.

This is an information-architecture change. The dashboard, QC table, and admin
config pages already exist and work — this design re-homes them under the
project and removes the global surfaces. No change to the ingestion pipeline,
the chart engine, RLS, or the data model.

## Goals

- Surface the evaluation dashboard as a **Data Collection** tab within a
  project, alongside the existing Phases / Board / List / Timeline tabs.
- The tab appears only on projects that have an evaluation. Projects without
  one (e.g. DARE, Intervention 3) show no tab and no clutter.
- Staff reach the QC (response review) table from inside the project.
- Admins create and configure a project's evaluation from the project's admin
  page (`/admin/projects/[id]`), alongside Budget and Team.
- Remove the global "Evaluations" nav item and the cross-project index pages.

## Non-goals

- Multiple evaluations per project. v1 keeps one active evaluation per project;
  `getEvaluationForProject(projectId)` already returns the active one.
- Any change to ingestion, the Kobo client, the aggregation/chart engine, RLS
  policies, or the database schema.
- A redesign of the dashboard's internal layout (modes, filters, charts).

## Approach

**Routed tab-link** (chosen over an in-page client tab). The existing project
tabs (Phases/Board/List/Timeline) are in-page shadcn `<Tabs>`. The dashboard is
a routed server page with URL-driven state (`?mode=`, `?region=`, …), its own
`loading.tsx`, and heavy chart rendering. Forcing it into a client `<Tabs>`
panel would lose URL deep-linking, lose the dedicated loading skeleton, and
render the charts as part of every project-page load.

Instead, **"Data Collection" is a tab-styled link** that navigates to the
existing dashboard route. The dashboard route renders the shared project header
and tab strip (with "Data Collection" marked active) so it reads as a tab. The
dashboard pages already exist as routes — this approach is both less work and
better-behaved.

## Surfaces

### 1. Staff — project tab strip

`src/app/workspace/projects/[id]/page.tsx` renders the project header and a
`<Tabs>` strip. Extract the **header + tab strip** into a shared component
(`ProjectTabStrip` or similar) so both the main project page and the dashboard
route render an identical strip.

- The strip gains a **"Data Collection"** entry — a `<Link>` styled to match the
  other tab triggers — rendered only when the project has an evaluation
  (`getEvaluationForProject(id)` is non-null).
- It links to `/workspace/projects/[id]/dashboard`.
- The four existing tabs stay in-page client tabs; "Data Collection" is the one
  routed entry. When the user is on `/dashboard`, "Data Collection" is the
  active style and the four in-page tabs are inactive links back to the project
  page.

`src/app/workspace/projects/[id]/dashboard/page.tsx` (exists) is updated to
render the shared header + tab strip above the `DashboardView`.

The dashboard header (inside `DashboardView`, staff controls area) gains a
staff-only **"Review responses"** link → the QC table (surface 2).

### 2. Staff — QC table

Move `src/app/workspace/evaluations/[id]/responses/page.tsx` →
**`src/app/workspace/projects/[id]/responses/page.tsx`**.

- Re-keyed by `projectId` (resolves the evaluation via
  `getEvaluationForProject`) instead of `evaluationId`.
- Same table, same `qc_status` filter chips, same `QcRowActions`.
- Carry over its `loading.tsx`.
- Page header links back to the Data Collection dashboard for the project.

### 3. Client — portal project tabs

`PortalProjectTabs` currently has a fixed tab list; the dashboard is reached via
a "View evaluation dashboard" link rendered below the strip.

- Add **"Data Collection"** as a real tab in `PortalProjectTabs`, shown only
  when the project has an evaluation. It links to
  `/portal/projects/[id]/dashboard` (exists).
- Remove the now-redundant "View evaluation dashboard" link added below the
  strip in Part 2.

Because `PortalProjectTabs` is a client component with a fixed list, the
project page passes it a `hasEvaluation` boolean prop (computed server-side) so
the tab renders conditionally.

### 4. Admin — project evaluation config

The admin project detail page (`/admin/projects/[id]`) already has sub-sections
(Budget, Team, Edit). Add an **Evaluation** (or "Data Collection") section:
**`src/app/admin/projects/[id]/evaluation/page.tsx`**.

This page hosts everything from the current `/admin/evaluations/[id]` plus the
*creation* entry point:

- If the project has **no evaluation**: a "Set up data collection" form —
  create the `evaluations` row (name, slug, target N) for this project.
- If it **has** one: the existing config surface — instrument info, Kobo token
  form, schema-config display, dashboard-spec JSON editor, MIS investments
  upload, recent ingestion runs, open-issue triage.
- Reuses the existing components: `DashboardConfigEditor`, `MisUploadForm`,
  `KoboTokenForm`, and the existing `resolveIngestionIssue` flow.

The admin project page gets a link/section entry pointing here, matching how
Budget/Team are surfaced.

### 5. Removed

- The **"Evaluations"** nav item in `src/app/workspace/layout.tsx` and
  `src/app/admin/layout.tsx`.
- `src/app/workspace/evaluations/` — the index page (`page.tsx`), its
  `loading.tsx`, and the now-relocated `[id]/responses/` route.
- `src/app/admin/evaluations/` — the index (`page.tsx`), `[id]/page.tsx`, and
  their `loading.tsx` files.

The `src/lib/evaluations/` library (queries, actions, ingest, aggregate, etc.)
and `src/components/evaluations/` are **kept** — only the page/route wrappers
move. `listEvaluations()` (the cross-project query) becomes unused and is
removed.

## Data flow

Unchanged from Part 2. Each relocated page resolves the evaluation the same way
the existing dashboard pages do:

```
projectId → getEvaluationForProject(projectId) → evaluation
          → getEvaluation(evaluation.id) → instruments, dashboard_configs
```

RLS already scopes every `evaluation_*` read by project membership, so
project-keyed routes need no new authorization logic — the page-level role
gates (`getCurrentProfile()` for workspace/admin, portal membership for portal)
are carried over from the existing pages.

## Routing summary

| Surface | Before | After |
|---|---|---|
| Staff dashboard | `/workspace/projects/[id]/dashboard` | unchanged (now a tab) |
| Staff QC table | `/workspace/evaluations/[id]/responses` | `/workspace/projects/[id]/responses` |
| Staff index | `/workspace/evaluations` | removed |
| Portal dashboard | `/portal/projects/[id]/dashboard` | unchanged (now a tab) |
| Admin config | `/admin/evaluations/[id]` | `/admin/projects/[id]/evaluation` |
| Admin index | `/admin/evaluations` | removed |

## Testing

- The existing evaluation unit/integration/RLS tests are unaffected — they test
  `src/lib/evaluations/*` and the data layer, none of which changes.
- Update any test or helper that references the removed routes (none of the
  current automated tests navigate routes — they exercise the lib directly — so
  this is expected to be a no-op; confirm during implementation).
- Manual verification: on the SOCO project the Data Collection tab appears for
  staff and (portal) client; on DARE / Intervention 3 it does not; the admin
  project page exposes the Evaluation config section and the "Set up data
  collection" form works for a project with no evaluation.

## Risks

| Risk | Mitigation |
|---|---|
| Extracting the project header/tab strip touches a working page | Keep the extraction mechanical — move markup into a component, no behaviour change; the four in-page tabs keep working exactly as before. |
| `PortalProjectTabs` is a fixed-list client component | Pass a `hasEvaluation` boolean prop; the tab is one conditional entry. |
| Removed routes leave dead imports (`listEvaluations`) | Delete the unused query export; typecheck catches stragglers. |
