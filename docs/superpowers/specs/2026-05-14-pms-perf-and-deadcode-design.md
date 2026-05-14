# PMS Performance Optimization & Dead-Code Removal — Design

**Date:** 2026-05-14
**Author:** Senior web engineering pass on `dcahub-pms`
**Status:** Approved, ready for implementation plan

## 1. Background and goals

The DC&A Hub PMS (`dcahub-pms`, Next.js 16 + React 19 + Supabase) is reported as slow in three areas:

- **(a)** Initial page load (cold)
- **(b)** Navigation between routes
- **(c)** Data fetching (Supabase queries)

Secondary goal: remove dead code conservatively, and reduce Vercel **edge / function request volume**.

This spec proposes a layered, low-risk plan that delivers measurable improvements without restructuring the application.

## 2. Baseline (measured against the existing `.next` build)

- Total client JS across chunks: **~2.21 MB** uncompressed.
- Largest single client chunk: **~322 KB** (suspected `xlsx`-adjacent code path; to verify).
- Total CSS: **~148 KB**.
- Largest source files: `workspace-view.tsx` (39.5 KB), `activity-detail-view.tsx` (34 KB), `parts.tsx` (27 KB), `workspace/actions.ts` (26 KB), `admin/page.tsx` (20 KB).
- 73 source files import from `lucide-react`.
- `xlsx` (sheetjs CDN tarball) is referenced in `src/lib/workspace/actions.ts` (`"use server"`) and `src/app/api/workplan/template/route.ts` only.
- No `src/middleware.ts` exists in the main repo (only in worktrees).
- `app/providers.tsx` is minimal (`ThemeProvider` only).
- Notifications bell uses a debounced 800 ms refresh — not a polling loop.

These baseline numbers are the comparison point for every subsequent change.

## 3. Non-goals

- No restructuring of `workspace-view.tsx`, `parts.tsx`, or any large component beyond the splits explicitly listed below.
- No change to auth flow, no introduction of `middleware.ts`.
- No new client-side data libraries (React Query, SWR, Zustand, etc.).
- No aggressive dead-code cleanup beyond unused files / unused exports / unused deps.

## 4. Scope — four layers

### Layer 1 — Data-fetching wins (TTFB and navigation feel)

Targets complaints (b) and (c).

**L1.1 — SQL aggregation for project counts.**
Add a Postgres view `project_activity_counts(project_id, done_count, total_count)` (or an RPC) under `supabase/migrations/`. Replace the in-JS counting in:
- `lib/workspace/queries.ts::listWorkspaceProjects` (no longer pulls `phases(id, activities(id, phase_id, status))`).
- `lib/workspace/queries.ts::getWorkspaceProject` (no longer pulls all activities).
- The activity aggregation in `app/admin/page.tsx::getDashboardData` (no longer pulls all activities for all visible projects).

**L1.2 — Push filters and sort to the DB.**
`app/workspace/page.tsx` currently sorts and status-filters in JS after fetching everything. Move `status`, `sort`, and a `limit` (default 50) into the `.from('projects')` query. Add a `page` searchParam for older results.

**L1.3 — Streaming Suspense islands on the admin dashboard.**
Decompose `getDashboardData` into N small async loaders (`getTotals`, `getHealth`, `getTasks`, `getAttention`, `getRecentProjects`, `getMilestones`, `getActivityFeed`). Render each card inside its own `<Suspense fallback={<SkeletonX />}>`. The page now streams from the server instead of blocking on the slowest query.

**L1.4 — Add `loading.tsx` at top route segments.**
`/admin`, `/workspace`, `/portal`, `/workspace/projects/[id]`. Each provides a skeleton matching the page layout.

**L1.5 — `React.cache()` audit.**
Verify every query helper called from multiple components in one render is wrapped in `cache()`. Today this is done in `lib/workspace/queries.ts` but not consistently across `lib/admin/queries.ts` and `lib/portal/`.

**L1.6 — Selective `revalidate`.**
Add `export const revalidate = 60` to read-only dashboard segments (`/admin/page.tsx`, `/admin/projects/page.tsx`, `/admin/clients/page.tsx`). 60 seconds of staleness is acceptable for these surfaces and the savings on edge function invocations are significant (see Layer 4).

### Layer 2 — Bundle & client-runtime wins

Targets complaint (a).

**L2.1 — Verify and quarantine `xlsx`.**
Inspect production build output to confirm `xlsx` does not appear in any client chunk. Replace the top-level `import * as XLSX from "xlsx"` in `lib/workspace/actions.ts` with a lazy `await import("xlsx")` inside the single action that needs it, so cold action invocations that do *not* touch Excel don't pay the parse cost.

**L2.2 — Dynamic import below-the-fold client islands.**
- `components/workspace/activity-detail-view.tsx` (34 KB): keep mounted, but split its less-used sub-sections (proof gallery, timeline) behind `next/dynamic` with a tiny skeleton.
- `components/admin/project-detail/workspace-view.tsx` (39.5 KB): same treatment for tabs that aren't the default tab.
- `components/workspace/workplan-import-form.tsx`: already gated behind a UI action; load dynamically.

**L2.3 — Lucide import audit.**
Confirm all `lucide-react` imports are *named* (already the case in spot checks). If any namespace imports exist, fix. Verify the final bundle doesn't ship the full icon set.

**L2.4 — `images` config check.**
`next.config.ts` already has good `minimumCacheTTL`, narrowed `deviceSizes`, AVIF/WebP. No change expected; verify on a real client.

### Layer 3 — Dead code removal (conservative)

Targets the "remove all dead codes" requirement.

**L3.1 — `knip` one-shot pass.**
Run `npx knip --reporter compact` and review its three categories:
- **Unused files** — delete only after grep confirms zero references (including dynamic strings).
- **Unused exports** — remove the export keyword or delete the symbol; keep the file if it has used exports.
- **Unused dependencies and devDependencies** — remove from `package.json`.

Land each category as its own commit so revert is surgical.

**L3.2 — Stray Windows-mangled folder.**
The earlier `Get-ChildItem` of the repo root showed an oddly-named directory `CUsersishmaDesktopdcahub-pmsscripts` (a path-mangling accident from a prior command). Verify it exists, inspect contents, delete if it's a duplicate of `scripts/`.

**L3.3 — ESLint `no-unused-vars` cleanup.**
Tighten `@typescript-eslint/no-unused-vars` to `error` (allowing the conventional `_`-prefix escape). Fix the resulting handful of issues. Avoids the unused-vars drift `knip` doesn't catch.

**L3.4 — `.gitignore` hygiene for `.claude/worktrees/`.**
Confirm `.claude/worktrees/*` is in `.gitignore` and not tracked. If tracked, untrack it (no file deletion needed locally).

### Layer 4 — Reduce Vercel edge / function requests

A new requirement added after design review. The PMS is on Vercel; every dynamic page render is a function invocation, and every navigation to an uncached route bills another one. Goals: reduce per-user invocations without breaking interactivity.

**L4.1 — Cache static dashboards with `revalidate`.**
Covered by **L1.6**. Setting `revalidate = 60` on `/admin`, `/admin/projects`, `/admin/clients` means at most one function invocation per minute per route per region, regardless of viewer count.

**L4.2 — Long-lived caching on public assets.**
`next.config.ts` already sets `Cache-Control: public, max-age=31536000, immutable` on the explicit asset list. Audit `public/` for files served outside that list (any logo/icon added after the regex was last updated) and broaden the regex. One-time win, reduces repeat asset fetches against the function/edge layer.

**L4.3 — Consolidate auth + profile in a single round-trip per render.**
Today, multiple server components in the same render tree call `getCurrentProfile()`. With `React.cache()` this is one call per render, but only when both helpers go through the same cached entry. Add a single `cache()`-wrapped `getSessionAndProfile()` and route both auth-guard helpers and page bodies through it. Reduces Supabase round-trips per page render from 2–3 down to 1, which in turn shortens function execution time (billed in 100 ms chunks on Vercel).

**L4.4 — Conditional notifications-bell polling.**
The bell already debounces refreshes; ensure it does not fire when `document.hidden` is true (it appears to handle this — confirm and tighten). Each suppressed refresh saves one `/api/notifications/feed` invocation per tab.

**L4.5 — Static caching of `/api/workplan/template`.**
The template route returns a deterministic XLSX. Serve it with `Cache-Control: public, max-age=86400, immutable` and a content hash in the path so it's served from the CDN, not regenerated per download.

## 5. Acceptance / verification

For each layer, the PR must include:

- A **before** measurement (existing `.next/static` JS bytes for L2; Server Timing or manual timing for L1/L4; `knip` report for L3).
- An **after** measurement using the same methodology.
- All existing tests (`npm test`) green.
- A successful `npm run build` with no new warnings.
- Manual smoke of `/admin`, `/workspace`, `/portal`, `/workspace/projects/[id]`, `/admin/projects/[id]`.

Specific targets (best-effort, not contractual):

- Layer 1: cut admin TTFB by ≥40% on a project set with >50 projects.
- Layer 2: cut largest client chunk by ≥20%, total JS by ≥10%.
- Layer 3: remove ≥10 unused files / exports / deps in aggregate.
- Layer 4: cut function invocations on read-heavy dashboard routes by ≥80% at >1 viewer/min.

## 6. Risks and rollback

- **L1.1 (SQL view):** Wrong join could under- or over-count. Mitigated by: (i) a vitest unit test that compares the view's output to the existing JS aggregation on a seed dataset, (ii) per-PR rollback by deleting the view and reverting query helpers.
- **L1.3 (Suspense islands):** If a loader throws, only its card shows an error boundary instead of the whole page failing. Acceptable, but the existing `error.tsx` files must still cover the page-level case.
- **L2.1 (lazy xlsx):** First Excel-touching action call now pays a one-time module-load cost. Acceptable: actions are infrequent and run server-side.
- **L3.1 (knip):** Risk of deleting a file referenced only via a dynamic string. Mitigated by manual review and one-commit-per-category landing.
- **L4.1 (`revalidate=60`):** Dashboard data may be up to 60 s stale. Confirmed acceptable for the surfaces selected (no transactional reads).
- **L4.3 (consolidated session/profile):** A regression here breaks every authenticated page. Mitigated by keeping the existing helpers as thin wrappers over `getSessionAndProfile()`.

## 7. Ordering

Layers will be implemented in order **L1 → L4 → L2 → L3**. Rationale: L1 + L4 are where users feel the change; L2 is independent and lands afterward; L3 is cleanup that benefits from already-touched files.

Each layer is independently revertable. Layers do not share commits.

## 8. Out of scope (recorded so they are not forgotten)

- Splitting the four oversized component files into smaller modules.
- Introducing `middleware.ts` for auth.
- Migration to a client-side data layer (React Query / SWR).
- Database indexing review beyond what L1.1 implicitly requires.
