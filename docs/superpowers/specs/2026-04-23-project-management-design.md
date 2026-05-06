# Project Management Module — Design Spec

**Date:** 2026-04-23
**Status:** Approved for planning
**Replaces:** Performance Management module (migration `004_performance_management.sql`)

## 1. Purpose

Replace the Performance Management module with a Project Management module that lets MEL managers track time-bound SRSF projects (Enterprise Spotlight, ABSA Onboarding, Nkabom Collaborative) and lets executives see at-a-glance progress and what needs attention. KPIs/performance targets remain out of scope — those live in Factura.

## 2. Terminology reclassification

- **Programs** (ongoing / recurring): Virtual University, Hangout.
- **Projects** (time-bound, tracked via activities): Enterprise Spotlight, ABSA Onboarding, Nkabom Collaborative.

Enterprise Spotlight and ABSA Onboarding move from Programs to Projects. Their existing data-entry forms and program dashboards are re-housed as a "Program Data" tab inside the project's detail page (no loss of historical data). Nkabom Collaborative is new and has no linked program data.

## 3. Roles & permissions

- **Executives** — view only. No data entry anywhere in the module.
- **MEL Managers** — create/edit projects, add milestones and activities, assign owners, upload attachments, delete attachments, override project status to Blocked.
- **Activity Owners** (staff assigned to a specific activity) — update their own activity's `status`, `percent_complete`, `last_update_text`; post updates; upload attachments. Cannot edit title/due_date/priority/milestone/owner.
- **All other users with `projects` module access** — view only.

## 4. Navigation and route changes

Sidebar (`src/lib/constants.ts`):
- Remove **Performance** nav item.
- Add **Projects** nav item → `/projects` (icon `FolderKanban`, module `projects`).
- **Programs** dropdown trims to Virtual University and Hangout only.

`AppModule` union: replace `performance` with `projects`. Update `MODULE_LABELS`.

Routes:
- Delete `src/app/(dashboard)/performance/**` and `src/components/performance/**`.
- Delete `src/app/(dashboard)/programs/enterprise-spotlight/` and `src/app/(dashboard)/programs/absa/`.
- Add `src/app/(dashboard)/projects/page.tsx` (index grid).
- Add `src/app/(dashboard)/projects/[slug]/page.tsx` (detail with tabs).

Data-entry forms for ES and ABSA remain functional (still write to existing program data tables). Only their program-level dashboard routes move.

## 5. Data model

New migration `supabase/migrations/005_projects.sql`.

### 5.1 Drops (from `004_performance_management.sql`)

Drop performance tables in reverse FK order. Verified table names during implementation; expected set includes: `proof_of_work`, `activity_updates` (performance-scoped), `staff_assignments`, `goal_activities`, `goals`, `department_staff`, `departments`. Also update any `user_roles`/`module_access` rows referencing `performance` → `projects`.

### 5.2 `projects`

| col | type | notes |
|---|---|---|
| id | uuid pk default gen_random_uuid() | |
| name | text not null | |
| slug | text unique not null | |
| description | text | |
| owner_user_id | uuid not null fk → auth.users | MEL manager |
| program_slug | text | links to existing program for Program Data tab (nullable; ES, ABSA only) |
| start_date | date | |
| target_end_date | date | |
| status_override | text | enum: `blocked`, `done`; nullable; overrides computed status |
| archived_at | timestamptz | |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |

### 5.3 `project_milestones`

| col | type | notes |
|---|---|---|
| id | uuid pk | |
| project_id | uuid not null fk → projects on delete cascade | |
| name | text not null | |
| order_index | int not null default 0 | |
| created_at | timestamptz default now() | |

### 5.4 `project_activities`

| col | type | notes |
|---|---|---|
| id | uuid pk | |
| project_id | uuid not null fk → projects on delete cascade | |
| milestone_id | uuid fk → project_milestones on delete set null | nullable |
| title | text not null | |
| description | text | |
| owner_user_id | uuid not null fk → auth.users | |
| due_date | date | |
| status | text not null default 'not_started' | check in (`not_started`,`in_progress`,`done`,`blocked`) |
| priority | text not null default 'medium' | check in (`low`,`medium`,`high`) |
| percent_complete | int not null default 0 | check 0–100 |
| last_update_text | text | |
| last_update_at | timestamptz | |
| created_by | uuid not null fk → auth.users | |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |

Indexes: `(project_id)`, `(owner_user_id)`, `(due_date)`, `(status)`.

### 5.5 `project_activity_updates`

Audit log of status changes and notes.

| col | type | notes |
|---|---|---|
| id | uuid pk | |
| activity_id | uuid not null fk → project_activities on delete cascade | |
| user_id | uuid not null fk → auth.users | |
| note | text not null | |
| status_before | text | |
| status_after | text | |
| created_at | timestamptz default now() | |

Index: `(activity_id)`.

### 5.6 `project_activity_attachments` (proof of activity)

| col | type | notes |
|---|---|---|
| id | uuid pk | |
| activity_id | uuid not null fk → project_activities on delete cascade | |
| uploaded_by | uuid not null fk → auth.users | |
| file_path | text not null | Supabase Storage key |
| file_name | text not null | original filename |
| mime_type | text not null | |
| size_bytes | bigint not null | |
| caption | text | |
| created_at | timestamptz default now() | |

Index: `(activity_id)`.

Supabase Storage bucket: `project-activity-proofs` (private). Path pattern `{project_id}/{activity_id}/{uuid}-{filename}`. Accepted types: images (png/jpg/webp), pdf, docx, xlsx. Max size 25 MB per file (enforced in UI + Storage policy).

### 5.7 RLS policies

`projects`, `project_milestones`, `project_activities`:
- `SELECT` — any authenticated user with `projects` module access.
- `INSERT`/`DELETE` — MEL managers only.
- `UPDATE` on `projects` and `project_milestones` — MEL managers only.
- `UPDATE` on `project_activities` — MEL managers for all columns; activity's `owner_user_id` allowed only to change `status`, `percent_complete`, `last_update_text`, `last_update_at`, `updated_at`.

`project_activity_updates`:
- `SELECT` — any authenticated user with `projects` access.
- `INSERT` — any authenticated user where `user_id = auth.uid()` AND they are either the activity's owner or a MEL manager.

`project_activity_attachments`:
- `SELECT` — any authenticated user with `projects` access.
- `INSERT` — activity owner or MEL manager, with `uploaded_by = auth.uid()`.
- `DELETE` — MEL managers only.

Storage bucket `project-activity-proofs`: read for any authenticated user with `projects` access; insert for activity owner or MEL manager; delete for MEL manager.

### 5.8 Hard rule — proof required to mark Done

Enforced via a `BEFORE UPDATE` trigger on `project_activities`: if `NEW.status = 'done'` and `OLD.status <> 'done'`, reject unless at least one row exists in `project_activity_attachments` for `activity_id = NEW.id`. UI enforces the same rule (disables the "Mark Done" action and surfaces the reason) so the DB error is never the primary feedback path.

### 5.9 Computed project status

Helper in `src/lib/projects/status.ts` (client + server). Precedence:

1. `Done` — all activities `done`, and at least one activity exists.
2. `Blocked` — `status_override = 'blocked'`.
3. `At Risk` — any activity overdue (`due_date < today` and `status != done`), OR any `priority='high'` activity with `status='blocked'`.
4. `In Progress` — any activity with `status != 'not_started'`.
5. `Not Started` — default.

Overall progress % = `count(status='done') / count(*)` (0 if no activities).

### 5.10 Seed rows

- Enterprise Spotlight — slug `enterprise-spotlight`, `program_slug='enterprise-spotlight'`.
- ABSA Onboarding — slug `absa-onboarding`, `program_slug='absa'`.
- Nkabom Collaborative — slug `nkabom-collaborative`, `program_slug` null.

Owner set to first MEL manager found at migration time; otherwise NULL-tolerant seed with owner patched by admin after launch. (Column is `not null`; if no MEL manager exists at migration time, seed is deferred to a separate admin action — document this in migration comments.)

## 6. UI

### 6.1 `/projects` — Index page

- Header: "Projects" + "+ New Project" button (MEL manager).
- Responsive card grid (1 / 2 / 3 cols).
- Card content: name, status pill, owner avatar + name, progress bar with %, "X overdue · Y need attention" chip (only rendered when >0), "Updated Nd ago — [last_update_text]" footer.
- Click card → `/projects/[slug]`.

### 6.2 `/projects/[slug]` — Project detail

- Header block: name, description, owner avatar, start/target dates, status pill, progress bar.
- Actions (MEL manager only): "Edit Project", "Mark Blocked" / "Unblock".
- Tabs:
  - **Activities** (always present, default).
  - **Program Data** — rendered only if `program_slug` is set; mounts the shared `<ProgramDashboard slug={program_slug} />` component.

### 6.3 Activities tab

- Toolbar: filter chips (All / Overdue / Needs attention / My activities), sort (Due date / Priority / Status), "+ Add Activity" and "+ Add Milestone" (MEL manager).
- Milestones rendered as collapsible sections in `order_index` order; un-milestoned activities grouped under "Ungrouped" at the bottom.
- Activity row: status pill, priority flag icon, title, owner avatar, due date (red if overdue), mini % bar, preview of `last_update_text`.
- Click row → activity side panel.

### 6.4 Activity side panel

- Header: title, status, priority, owner, due date.
- Body:
  - Description.
  - **Proof of activity** section — thumbnail grid for images + file list for PDFs/docs. "Upload proof" button (owner or MEL manager). Each attachment shows uploader, timestamp, caption, download; MEL manager sees delete.
  - **Updates log** (newest first).
  - **Post update** form — free-text note; optional status change and % complete. Owner sees only these; MEL manager additionally sees edit fields for title, description, priority, due date, milestone, owner.
- "Mark Done" action disabled with tooltip "Upload at least one proof of activity" when zero attachments exist.

### 6.5 Executive Dashboard (`/dashboard`) — Projects strip

- New section "Projects" with "View all →" link to `/projects`.
- 3 condensed project cards side-by-side: name, status pill, progress bar, overdue count.
- Inserted below existing KPI/chart sections.

### 6.6 Components (new, in `src/components/projects/`)

- `project-card.tsx` (`variant: "full" | "compact"`)
- `project-form-modal.tsx`
- `milestone-form-modal.tsx`
- `activity-form-modal.tsx` (MEL manager full-field form)
- `activity-side-panel.tsx`
- `activity-row.tsx`
- `status-pill.tsx`, `priority-flag.tsx`
- `attachments-gallery.tsx` (upload, list, delete)
- `projects-dashboard-strip.tsx` (executive dashboard section)

### 6.7 Shared refactor

Extract body of the current `/programs/[slug]/page.tsx` into a reusable `<ProgramDashboard slug={...} />` component under `src/components/programs/` (or equivalent). Used by the remaining Virtual University and Hangout program routes, and by the Program Data tab inside ES and ABSA project pages.

## 7. Out of scope (YAGNI)

- Gantt charts, dependencies, drag-to-reorder (only `order_index` column prepared for later).
- Notifications or emails.
- Project templates.
- Bulk activity import.
- Comments/threads on activities beyond the updates log.
- Time tracking.

## 8. Risks

- **Destructive migration.** Dropping performance tables deletes existing performance data. Confirmed by product owner.
- **User role migration.** Rows in role/access tables referencing `performance` must be updated to `projects` (or dropped). Handled in migration step 5.1.
- **Seed owner.** Seed projects require a valid MEL manager as owner. If none exists at migration time, seeds are deferred and must be inserted manually post-migration.
- **Storage cost.** Attachments are unbounded per activity. 25 MB-per-file cap is set; no overall per-project cap yet. Monitor and add later if needed.

## 9. Acceptance criteria

- Performance Management is fully removed from UI, nav, and DB.
- `/projects` shows the 3 seeded projects with live computed status.
- A MEL manager can create a new project, add milestones, add activities, assign owners.
- An activity owner can post an update and upload attachments.
- Attempting to mark an activity `done` without at least one attachment fails in both UI and DB.
- Opening the ES or ABSA project shows Activities by default and Program Data when switched; the Nkabom project shows only Activities.
- Executive Dashboard renders a Projects strip with 3 condensed cards linking to each project detail.
- No references to `performance` remain in `src/lib/constants.ts`, nav, routes, or types.
