# Performance Module — ED-Centered Redesign

**Date:** 2026-04-19
**Project:** SRSF MIS (Springboard Road Show Foundation)
**Scope:** Holistic UX/UI rethink of the Performance module, centered on the Executive Director. Also integrates Performance into the Executive Dashboard as a filter option.

---

## 1. Goals

The ED primarily uses the Performance module on her phone, outside the office. Her core job is a **10-second health read** across all 5 departments, with the ability to drill into a department when something needs a closer look.

The redesign should:

- Answer "is the org on track?" in one glance.
- Show **all 5 departments** every time — on-track and off-track alike — without alarmist framing. The tone is informational, not urgent.
- Provide a purpose-built drill-down for a 15-second deep-read on any single department.
- Surface the same data inside the existing Executive Dashboard via the `ProgramFilterBar`, so Performance becomes selectable alongside ES / VU / Hangout / ABSA.

Manager and Staff views are **out of scope** for this redesign (they continue to use the current components).

---

## 2. Visual language

A single coherent visual system shared by the `/performance` home, the ED drill-down, and the Performance filter view on the Executive Dashboard.

**Theme:** Dark. `#0B0F17` page background, `#151B27` card surface. Text `#FFFFFF` primary, `#8891A6` secondary.

**Status colors:**

| Status    | Accent    | Surface tint                         |
|-----------|-----------|--------------------------------------|
| On track  | `#4ADE80` / `#22C55E` | card surface `#151B27`, badge bg `#052E16` |
| At risk   | `#FBBF24` / `#F59E0B` | gradient `#1F1405 → #151B27`, border `#F59E0B33` |
| Behind    | `#F87171` / `#DC2626` | same pattern, red tokens             |

**Typography:** Inter (or system), tight letter-spacing on headings, 800 weight for large numeric displays, 10–11px uppercase 2px-tracked labels for section headers.

**Shapes:** 18–24px rounded corners on cards, 12–14px on nested elements, 999px on pills and quarter chips.

**Shared primitives:**

- **Hero tile** — big % + status label + trend delta ("▲ 6% vs last quarter"), gradient background keyed to status.
- **Segmented bar** — 6px tall, rounded, showing the proportion of on-track / at-risk / behind departments, with aligned sub-labels beneath.
- **Department card** — 44px rounded monogram badge (MEL → "ME"), name + "X of Y activities complete" on the left, % + status pill on the right. At-risk variants use a gradient surface and subtle amber border.

---

## 3. Screens

### 3.1 `/performance` — ED home

Single scrollable screen, mobile-first. Accessed by admins/EDs.

**Structure (top to bottom):**

1. **Header** — "Performance" title + date line + quarter chip (`Q2 · 2026 ▾`) for switching.
2. **Hero tile** — org-wide percentage ("78%") with trend delta vs last quarter, plus one-line summary "4 of 5 departments on track · 51 of 64 activities done this quarter".
3. **Segmented bar** — breakdown by status with sub-labels "4 ON TRACK · 1 AT RISK · 0 BEHIND".
4. **Department list** — all 5 departments as stacked cards. On-track cards use the default surface; at-risk/behind cards use the tinted variant. Tapping any card → ED drill-down.

**Explicitly removed from the current design:**

- The 4-KPI row (Overall / On Track / At Risk / Overdue) — redundant with the new hero + segmented bar.
- The separate "Alerts" panel — problem items surface inline on the relevant department card, and the drill-down covers the detail.
- Alarmist "Needs your attention" framing.

### 3.2 `/performance/[departmentId]` — ED drill-down

Read-only view the ED lands on when she taps a department card. Must NOT reuse the Manager view (too much surface area for a 15-second read).

**Structure:**

1. **Header** — back arrow, quarter label, department name.
2. **Status hero** — large % + status label (ON TRACK / AT RISK / BEHIND), manager name on the right, segmented bar showing done/pending/overdue activity counts.
3. **Goals strip** — one card per quarterly goal with an inline progress bar. At-risk goals get a subtle amber border.
4. **Overdue list** — renders only when > 0. One row per overdue activity: title, assigned staff name, "X days late" in red. Red left border. Each row is tappable to show the activity's details (submissions if any, or the empty state).
5. **Last submission** — a small card showing the most recent completed activity across the department, to signal the team isn't silent even when the top-line % looks low.

**Role handling:** The existing `/performance/[departmentId]/page.tsx` currently routes to `ManagerDashboard`. We keep that routing for managers. EDs (role = Admin) must render the new ED drill-down component instead. Role is resolved in the page file and dispatches to one of two components.

### 3.3 Executive Dashboard — Performance filter

Add Performance as a fifth option in the existing `ProgramFilterBar`.

- **Mobile:** Performance becomes another entry in the existing `Select` dropdown.
- **Desktop:** Performance becomes the rightmost tab in the segmented button strip.

When the Performance filter is active, the `ExecutiveDashboard` body swaps to render the same content as `/performance` home (hero tile, segmented bar, department list). Tapping a department card navigates into the ED drill-down, same as from `/performance`.

Date range filter and export button do not apply to the Performance view (Performance is keyed by quarter, not arbitrary date range). When Performance is the active filter, both controls are hidden; a quarter chip is shown in their place to keep the control slot populated.

---

## 4. Component inventory

New components (`src/components/performance/`):

- `ed-home.tsx` — replaces current `ed-dashboard.tsx`. Composes hero, segmented bar, department list.
- `ed-drilldown.tsx` — new page-level component for the ED drill-down.
- `performance-hero-tile.tsx` — shared hero tile (used by `ed-home` and the Exec Dashboard filter view).
- `status-segmented-bar.tsx` — shared 6px segmented bar + sub-labels.
- `department-row-card.tsx` — replaces `department-card.tsx`. Horizontal row layout (monogram + name + % + status pill).
- `goal-progress-card.tsx` — used only in the drill-down.
- `overdue-activity-row.tsx` — used only in the drill-down.

Modified:

- `src/components/dashboard/program-filter-bar.tsx` — add `"performance"` to `ProgramFilter` union and `FILTER_OPTIONS`.
- `src/components/dashboard/executive-dashboard.tsx` — branch rendering when `programFilter === "performance"` to render the Performance body (delegates to the same composition used by `/performance`).
- `src/app/(dashboard)/performance/page.tsx` — render `EdHome` (new) for Admin role.
- `src/app/(dashboard)/performance/[departmentId]/page.tsx` — dispatch to `EdDrilldown` (new) for Admin role, continue to `ManagerDashboard` for managers.

Deprecated / unused after redesign:

- `src/components/performance/alerts-panel.tsx` — no longer composed into the ED surfaces. Kept if still referenced by the Manager view; removed if not.
- The 4-card KPI row in `ed-dashboard.tsx` — subsumed by the new hero + segmented bar.

---

## 5. Data

No schema changes. All data already exists in the hooks:

- `usePerformanceEd(year, quarter)` — returns `departments[]` with `done_count`, `pending_count`, `overdue_count`, `status`, `goals`, `progress_pct`. Sufficient for the home and filter views.
- A new hook or a narrowed selector is needed for the ED drill-down: given a `departmentId` + quarter, return goals with progress, overdue activities with assignee names, and the single most recent submission. This may reuse `usePerformanceManager` internally (the data shape overlaps) or be a new `usePerformanceEdDepartment` hook scoped to read-only fields. Prefer adding a new narrow hook rather than overloading the manager hook.

**Trend delta ("▲ 6% vs last quarter")** on the hero tile: requires one extra query for the prior quarter's aggregate completion %. Fetched alongside the current-quarter data in the ED home hook.

**Manager name** on the drill-down hero: join `user_departments` where `is_manager = true` for the department. Already available via the manager hook; expose it on the new ED hook too.

---

## 6. Interaction & navigation

- Quarter chip in the header opens the existing `QuarterSelector` (keep the component — only its visual wrapper changes).
- Tapping any department card in the home (or the filter view on the Exec Dashboard) → `/performance/[departmentId]`.
- Back arrow in the drill-down → previous screen (home or Exec Dashboard, depending on entry point).
- No action buttons (no "nudge manager", no comments, no exports) in this redesign.

---

## 7. Responsive behaviour

- Cards on the home and drill-down render as a single stacked column up to tablet width. On desktop the ED home uses a max-width (≈560px) centered layout — the design is optimised for phone and does not sprawl on desktop.
- The Performance filter view inside the Exec Dashboard respects the dashboard's existing container width; cards stretch to fill but the inner hierarchy is unchanged.

---

## 8. Out of scope

- Manager dashboard redesign.
- Staff dashboard redesign.
- Trend charts / sparklines on department cards.
- Notifications, messaging, "nudge manager" actions.
- Export or print views for performance data.
- Light-theme variant of the ED surfaces (dark-only for now; the rest of the app remains as-is).

These may be revisited once the ED redesign has landed and been used for a quarter.

---

## 9. Open questions

None at spec time. All decisions locked via brainstorming session (2026-04-19).

---

## 10. Mockup artefacts

Three HTML mockups were produced during brainstorming and live in `.superpowers/brainstorm/1859-1776618644/content/`:

- `ed-home-v2.html` — ED home (dark + light variants; dark selected).
- `ed-drilldown.html` — ED drill-down.
- `exec-dashboard-v2.html` — Executive Dashboard with Performance filter tab.

These are reference fidelity only — the implementation will use the existing Tailwind + shadcn stack, not raw HTML.
