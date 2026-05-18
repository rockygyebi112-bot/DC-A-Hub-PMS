# Internal Activities & SOCO Evaluation Dashboard — Design

**Date:** 2026-05-18
**Status:** Approved (pending spec review)
**Scope:** Two related features for DC&A Hub PMS:
1. Allow activities to be marked **internal** (hidden from clients) and add an **internal workspace** for work not tied to any project.
2. Add a **live evaluation dashboard** that ingests KoboCollect data and exposes progress + findings to clients and staff. First user: SOCO Midterm Review (HH + CPIC instruments).

---

## Part 1 — Internal-vs-client activities

### 1.1 Goals

- Let staff/admin record activities inside client projects that the client cannot see.
- Let staff/admin track DC&A Hub's own internal work (BD, HR, training, etc.) that has no client at all.
- Avoid accidental client exposure of internal items.

### 1.2 Schema changes

**`activities` table — add visibility column.**

```sql
alter table activities
  add column visibility text not null default 'client_visible'
    check (visibility in ('client_visible','internal'));
create index activities_visibility_idx on activities(visibility);
```

**New tables for the standalone internal workspace.**

```sql
create table internal_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  color text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table internal_tasks (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references internal_areas(id) on delete restrict,
  project_id uuid references projects(id) on delete set null,  -- optional cross-link
  title text not null,
  description text,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','blocked','done')),
  priority text check (priority in ('low','normal','high','urgent')),
  due_date date,
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index internal_tasks_area_idx on internal_tasks(area_id);
create index internal_tasks_status_idx on internal_tasks(status);
create index internal_tasks_project_idx on internal_tasks(project_id) where project_id is not null;

create table internal_task_assignees (
  task_id uuid not null references internal_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (task_id, user_id)
);
```

**Seed areas** (admin-editable later): Business Development, HR & Recruitment, Internal Training, Finance & Admin, Operations.

### 1.3 RLS

- **`activities`** — extend the existing client-portal SELECT policy to also require `visibility = 'client_visible'`. Staff/admin policies unchanged. Apply the same `visibility` predicate to dependent tables when accessed via the client portal: `activity_proofs`, `activity_log`, `proof_comments`, `proof_access_log` (each currently joins to `activities` for the project-membership check; tighten that join with the visibility filter).
- **`internal_areas`** — read: admin + staff. Write: admin only.
- **`internal_tasks`** — read: admin OR (staff AND assignee). Write: admin OR assignee.
- **`internal_task_assignees`** — read: same as parent task. Write: admin OR existing assignee.
- Clients have no policy on any internal_* table (default-deny).

### 1.4 Create / edit UI

**Activities (`/workspace/projects/[id]`).**
- Create form gains a required radio: **Client-visible** | **Internal only**. No default selection.
- Activity card/row in the staff workplan view gets a small "Internal" badge when `visibility = 'internal'`.
- Edit modal lets admin/staff flip visibility; the change is logged in `activity_log` with `meta = { visibility_changed_from, visibility_changed_to }`.
- Client portal: internal activities and their proofs/logs/comments are invisible end-to-end.

**Bulk upload (CSV/XLSX workplan import).**
- Add a `visibility` column to the template. Accepted values: `client_visible`, `internal`. Case-insensitive.
- Missing or invalid → row is rejected with a clear per-row error ("visibility is required: client_visible or internal").
- No silent defaulting.

### 1.5 Counts & rollups

The existing `project_activity_counts` view (migration 0021) splits into two outputs per project:

- `client_total`, `client_done` — denominator excludes `visibility = 'internal'`.
- `overall_total`, `overall_done` — everything.

The client portal renders client-facing counts only. Staff/admin pages show both side-by-side ("Client view: 12/18 · Overall: 17/24").

### 1.6 Internal workspace UI

- **`/workspace/internal`** — main page. List + Kanban toggle, grouped by area, filters: status, assignee, due date, priority. Side panel for task detail (title, description in markdown, assignees, status, priority, due date, optional linked project).
- **`/admin/internal/areas`** — manage areas (create / rename / archive / set color). Areas with active (non-archived) tasks cannot be archived without reassigning tasks first.
- A staff project page (`/workspace/projects/[id]`) gains a small "Internal tasks (n)" pill — staff/admin only — linking to a filtered view of internal_tasks for that project.
- Top navigation: new **Internal** item in the staff/admin sidebar, hidden from clients.

### 1.7 Out of scope (v1)

- Proofs / attachments on internal tasks.
- Comments / activity log on internal tasks.
- Recurring internal tasks.
- Time tracking.

---

## Part 2 — SOCO Evaluation Dashboard

### 2.1 Goals

- Pull KoboCollect submissions into the PMS on an hourly schedule (and on-demand).
- Give the SOCO client a live-feeling dashboard with collection progress and substantive findings drawn from the HH (and later CPIC) survey.
- Build it so the next M&E project DC&A Hub takes on is a configuration job, not a rebuild.

### 2.2 New domain: evaluations

An **evaluation** is a Kobo-driven data-collection effort attached to a project. It has one or more **instruments** (each tied to a Kobo form) and a dashboard config (KPIs + chart specs as JSON).

```sql
create table evaluations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  status text not null default 'collecting'
    check (status in ('draft','collecting','analyzing','closed')),
  collection_started_at timestamptz,
  collection_target_n int,
  dashboard_default_mode text not null default 'auto'
    check (dashboard_default_mode in ('auto','progress','findings')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table evaluation_instruments (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  kind text not null check (kind in ('hh','cpic','custom')),
  name text not null,
  kobo_form_id text not null,
  kobo_api_token_encrypted bytea,           -- pgsodium
  schema_config jsonb not null default '{}',
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table evaluation_dashboard_configs (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  version int not null default 1,
  spec jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table mis_investments (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  community text not null,
  district text not null,
  investment_type text not null,
  investment_name text not null,
  completion_date date,
  created_at timestamptz not null default now()
);
create index mis_inv_eval_community_idx on mis_investments(evaluation_id, community);

create table evaluation_responses (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references evaluation_instruments(id) on delete cascade,
  kobo_submission_uuid text not null,
  kobo_submission_id bigint,
  submitted_at timestamptz not null,
  raw jsonb not null,
  region text, district text, cluster text, community text,
  gender text, age int,
  qc_status text not null default 'pending'
    check (qc_status in ('pending','approved','edited','cancelled_redo','cancelled_dropped')),
  qc_checked_at timestamptz,
  qc_checked_by uuid references auth.users(id) on delete set null,
  ingested_at timestamptz not null default now(),
  unique (instrument_id, kobo_submission_uuid)
);
create index er_instrument_qc_idx on evaluation_responses(instrument_id, qc_status);
create index er_geo_idx on evaluation_responses(instrument_id, region, district, community);

create table evaluation_response_investments (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references evaluation_responses(id) on delete cascade,
  investment_id uuid references mis_investments(id) on delete set null,
  raw_investment_name text not null,
  answers jsonb not null,
  match_status text not null default 'auto'
    check (match_status in ('auto','manual','unmatched'))
);

create table evaluation_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references evaluation_instruments(id) on delete cascade,
  trigger text not null check (trigger in ('schedule','manual','backfill')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','ok','partial','error')),
  fetched_count int default 0,
  inserted_count int default 0,
  updated_count int default 0,
  unmatched_investment_count int default 0,
  error_message text
);

create table evaluation_ingestion_issues (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references evaluation_ingestion_runs(id) on delete set null,
  instrument_id uuid not null references evaluation_instruments(id) on delete cascade,
  kobo_submission_uuid text,
  kind text not null,
  details jsonb not null default '{}',
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
```

### 2.3 Dashboard spec format

The `evaluation_dashboard_configs.spec` JSON is the reusability seam. Schematic:

```json
{
  "kpis": [
    {
      "id": "soco_awareness",
      "label": "Heard of SOCO",
      "instrument": "hh",
      "numerator": { "field": "s3_a1", "eq": 1 },
      "denominator": "all_responses",
      "format": "percent"
    }
  ],
  "sections": [
    {
      "id": "reach",
      "title": "Project reach & participation",
      "charts": [
        { "type": "donut", "field": "s3_a1", "title": "Heard of SOCO?" },
        { "type": "bar_pct", "field": "s3_a2", "title": "How they heard",
          "filter": { "field": "s3_a1", "eq": 1 } },
        { "type": "stacked_bar", "field": "s3_a8", "by": "gender",
          "title": "Felt involved (by gender)" }
      ]
    }
  ],
  "disaggregations": {
    "geography": { "fields": ["s0_a4","s0_a5","s0_a7"], "labels": ["Region","District","Community"] },
    "gender": { "field": "s1_a1" },
    "soco_exposure": {
      "Heard of SOCO": { "field": "s3_a1", "eq": 1 },
      "Attended meeting": { "field": "s3_a4", "eq": 1 },
      "Participated in cohesion activity": { "field": "s3_c2", "eq": 1 }
    }
  }
}
```

Supported chart types in v1: `donut`, `bar_pct`, `stacked_bar`, `horizontal_bar`, `heatmap`, `choropleth`, `progress_bars`, `trend_line`. Each type is implemented once as a React Server Component that:
1. Reads the spec entry.
2. Builds a parameterized SQL aggregation against `evaluation_responses` (filtered by active QC + dashboard filter state).
3. Hands the aggregate to a small Recharts wrapper.

Adding a new evaluation = insert one `evaluation_dashboard_configs` row + a `schema_config` mapping per instrument. No new React components.

### 2.4 Ingestion pipeline

**Trigger.**
- Vercel cron in `vercel.json` calls `/api/evaluations/sync` every hour.
- Staff-only "Sync now" button on the dashboard calls the same endpoint with `?instrument_id=...&trigger=manual`, rate-limited to 1 manual run per instrument per 60s (uses the existing `rate_limit` infrastructure from migration 0027).

**Per run, for each active instrument** (`evaluations.status = 'collecting'`):
1. Decrypt the Kobo token (pgsodium, server-only, SERVICE_ROLE).
2. Paginate `GET https://kc.kobotoolbox.org/api/v2/assets/{kobo_form_id}/data/` with `query={"_submission_time":{"$gt":"<last_synced_at>"}}`.
3. For each submission: upsert into `evaluation_responses` keyed on `(instrument_id, kobo_submission_uuid)`. Map QC fields (`s7_*`) into `qc_status`.
4. For HH submissions with the repeating investment block: for each repeat, attempt match against `mis_investments` scoped by community (case-insensitive exact, then trigram fuzzy ≥ 0.85). Misses → `evaluation_ingestion_issues` with `kind = 'unmatched_investment'`.
5. Record summary in `evaluation_ingestion_runs`. Errors don't abort; partial success is acceptable.

**Idempotency.** Re-running over the same window is safe — UNIQUE on `(instrument_id, kobo_submission_uuid)` makes upserts deterministic.

**Backfill.** A dedicated `?trigger=backfill` mode pulls without the `_submission_time` filter (full re-fetch). Admin-triggered.

### 2.5 QC handling

- Approved submissions appear in client-facing charts (charts query `qc_status = 'approved'`).
- The dashboard's awaiting-QC counter shows `qc_status = 'pending'` only.
- `cancelled_redo` and `cancelled_dropped` are excluded from both counts entirely.
- Staff QC view: a table at `/workspace/evaluations/[id]/responses` showing all submissions with filters by `qc_status`, region, enumerator, and a row-level "Approve / Mark for redo / Cancel" action. The action updates `qc_status` and writes who/when.

### 2.6 Disaggregations & filtering

- Top filter bar on findings mode: **Geography** (Region → District → Community cascading), **Gender** (M/F/All), **SOCO exposure** (All / Heard of SOCO / Attended meeting / Participated in cohesion activity).
- Filters apply to all charts in the findings view. KPIs respect filters.
- Empty filtered cuts render "No data for this cut" in place of the chart.
- No small-N suppression (per product decision).
- No PII appears on the dashboard at any level. Names, phone numbers, and contact info live in the raw `evaluation_responses.raw` payload, surfaced only in the staff QC table (and only there).

### 2.7 Routes & access

- **Client**: `/portal/projects/[id]/dashboard` — read-only dashboard for that project's primary evaluation. Selector at top if multiple evaluations.
- **Staff**: `/workspace/projects/[id]/dashboard` — same UI + "Sync now" button + raw response table link.
- **Staff index**: `/workspace/evaluations` — all evaluations across all projects (status, last sync, response count, % of target N).
- **Admin**: `/admin/evaluations`, `/admin/evaluations/[id]` (manage instruments, Kobo tokens, schema config, dashboard spec, MIS investments CSV upload, ingestion-issue triage).

**Roles** map to existing `profiles.role` (admin / staff / client). Client access additionally requires `project_members` for the project; staff access additionally requires `project_members` for the project (admin sees all).

### 2.8 UI structure

**Top of every dashboard page** (both modes):
- Last-sync timestamp · "Sync now" button (staff only).
- Approved count + awaiting-QC count badge.

**Mode toggle** below the top bar. Defaults: `progress` while collection < 80% of target, `findings` once ≥ 80%. User can override per session (not persisted).

**Progress mode:**
- 6 KPI tiles: collected vs target, in-QC queue, districts active / total, F/M split, refusal+replacement rate, QC approval rate.
- Choropleth of the 6 northern regions shaded by % of target N achieved.
- Daily-submissions trend (last 30 days).
- Top enumerators by approval rate.
- Per-region progress bars vs target.

**Findings mode** (sections in this order; each section = 1–2 small charts that open to a detail view on click):
1. **Project reach & participation** — awareness, how they heard, meeting attendance & non-attendance reasons, CPIC awareness & quality perception.
2. **Infrastructure investments** — per-investment familiarity / use frequency / satisfaction / benefit.
3. **Social cohesion activities** — familiarity, participation, why-participated, satisfaction, benefits.
4. **Perceptions & attitudes** — trust in district / chief / community, involvement, who-benefits-more grid, social cohesion attitudes.
5. **Service satisfaction & change** — water, roads, market, education, health (satisfaction + 2-year change).
6. **Conflict & climate shocks** — conflict frequency / source, climate shocks experienced, SOCO's effect on coping.

**Chart detail view.** Clicking a chart opens a modal with: the same chart at full size, the underlying aggregated table, and a CSV-export button (staff only).

### 2.9 Performance

- v1: no pre-aggregation. Server-render each chart from `evaluation_responses` per page load. ~2,000 expected responses for SOCO HH; trivially fast.
- If a future evaluation crosses ~50k responses, add `evaluation_metrics_daily` materialized view refreshed by the sync job. Chart engine is unchanged — it queries the mat-view if present, falls back to live aggregation.

### 2.10 Secrets

Kobo API tokens are encrypted at rest using **pgsodium**. Decryption path is server-only (Next.js route handlers using `SUPABASE_SERVICE_ROLE_KEY`). Tokens are never exposed to clients or to staff users via API responses.

### 2.11 First-instrument config (SOCO HH)

A migration seeds:
- One `evaluations` row: project = SOCO project, name = "SOCO Midterm Review", target = 2000, status = `collecting`.
- One `evaluation_instruments` row: kind = `hh`, name = "Household survey", kobo_form_id = (admin sets via UI), `schema_config` mapping Kobo question codes to semantic names (`s0_a4 → region`, `s1_a1 → gender`, etc.).
- One `evaluation_dashboard_configs` row: full spec covering 6 KPIs + 6 sections per Section 2.8.

CPIC instrument is added the same way once its dashboard spec is drafted (out of scope for this implementation but the architecture supports it with zero new app code).

### 2.12 Out of scope (v1)

- Auto-generated narrative insights (Question 8 option C).
- FGD / qualitative content sections.
- Configurable dashboards via in-app UI (admin edits configs in SQL / a JSON editor).
- Export of raw responses for clients.
- Small-N suppression.
- Email / Slack alerts on ingestion failures (errors visible in admin UI only).

---

## Cross-cutting concerns

### Migrations

New SQL migrations land sequentially after `0029_atomic_invariants.sql`. Ordering:
1. `0030_activity_visibility.sql` — column + index + RLS update.
2. `0031_internal_workspace.sql` — internal_areas, internal_tasks, internal_task_assignees + seeds + RLS.
3. `0032_project_activity_counts_visibility.sql` — view rebuild.
4. `0033_evaluations_core.sql` — evaluations, evaluation_instruments, evaluation_dashboard_configs.
5. `0034_evaluations_data.sql` — mis_investments, evaluation_responses, evaluation_response_investments.
6. `0035_evaluations_ingestion.sql` — runs + issues tables.
7. `0036_evaluations_rls.sql` — RLS for all evaluation_* tables.
8. `0037_pgsodium_kobo_token.sql` — encrypted column key.
9. `0038_seed_soco_evaluation.sql` — SOCO row + HH config.

### Testing

- Vitest unit coverage for the chart-spec interpreter (every chart type) and the Kobo response → row mapper.
- RLS test suite extended for visibility, internal_*, and evaluation_* tables (client cannot see internal activities, internal_tasks, or unapproved responses).
- Integration test for ingestion with a fixture Kobo payload covering: new submission, re-submission, QC status mapping, unmatched investment, duplicate submission.

### Risks & mitigations

| Risk | Mitigation |
|---|---|
| Kobo form schema changes mid-collection (question added/removed) | `schema_config` is per-instrument JSON; admin updates mapping without touching code. Aggregator tolerates missing fields (treats as null). |
| MIS investment names vary across uploads | Reconciliation queue with manual override; trigram fuzzy match as a first pass. |
| Vercel cron skipped/failed run | Each run logs to `evaluation_ingestion_runs`; admin UI surfaces failed runs; on-demand sync covers gaps. |
| Client sees in-flight data they shouldn't | Charts query `qc_status = 'approved'` only; defense in depth via RLS that filters by qc_status for client role. |
| Internal activity accidentally created as client-visible | Visibility is a required field at create (no silent default), bulk upload rejects missing values, audit log captures any later flip. |
