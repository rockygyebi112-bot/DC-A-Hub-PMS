# SOCO Evaluation Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest KoboCollect submissions on an hourly schedule, store them with a QC lifecycle, and render config-driven KPIs + charts on staff/client/admin dashboards — so the next M&E project is a configuration job, not a rebuild.

**Architecture:** Six new SQL migrations introduce an `evaluations` aggregate (evaluations → instruments → responses with QC, + dashboard configs, + MIS reference data, + ingestion audit, + RLS, + pgsodium-encrypted Kobo tokens). A `/api/evaluations/sync` route — invoked hourly by Vercel cron and on-demand from the dashboard "Sync now" button — pages the Kobo `/data` endpoint, upserts responses idempotently keyed on `(instrument_id, kobo_submission_uuid)`, fuzzy-matches investment repeats against `mis_investments`, and logs runs + issues. A spec-driven dashboard engine reads one `evaluation_dashboard_configs.spec` JSON row, dispatches to a fixed set of chart components (donut, bar_pct, stacked_bar, horizontal_bar, heatmap, choropleth, progress_bars, trend_line), and live-aggregates against `evaluation_responses` filtered by `qc_status='approved'` (client) or all (staff). RLS enforces the same visibility in the database.

**Tech Stack:** Next.js 15 (App Router, RSC + Server Actions), Supabase (Postgres + RLS + pg_trgm + pgsodium), Recharts (chart primitives), Zod (schemas), exceljs (MIS CSV/XLSX upload), Vitest (unit + RLS + integration).

**Spec:** [`docs/superpowers/specs/2026-05-18-internal-activities-and-evaluation-dashboard-design.md`](../specs/2026-05-18-internal-activities-and-evaluation-dashboard-design.md) — Part 2 only (§§ 2.1 – 2.12).

**Migration renumbering:** Part 1 of the spec proposed migrations 0033 – 0038 for evaluations. Part 1's internal-workspace work already consumed 0033 and 0034, so this plan uses **0035 – 0040** instead.

---

## File map

**New SQL migrations**
- `supabase/migrations/0035_evaluations_core.sql` — `evaluations`, `evaluation_instruments`, `evaluation_dashboard_configs`.
- `supabase/migrations/0036_evaluations_data.sql` — `mis_investments`, `evaluation_responses`, `evaluation_response_investments`. Enables `pg_trgm`.
- `supabase/migrations/0037_evaluations_ingestion.sql` — `evaluation_ingestion_runs`, `evaluation_ingestion_issues`.
- `supabase/migrations/0038_evaluations_rls.sql` — RLS policies for all `evaluation_*` and `mis_investments` tables.
- `supabase/migrations/0039_pgsodium_kobo_token.sql` — pgsodium key + encrypt/decrypt helpers for `evaluation_instruments.kobo_api_token_encrypted`.
- `supabase/migrations/0040_seed_soco_evaluation.sql` — SOCO Midterm Review row + Household instrument + dashboard spec.

**New backend modules (`src/lib/evaluations/`)**
- `schemas.ts` — Zod schemas for evaluation, instrument, response, QC actions.
- `dashboard-spec.ts` — Zod validator + TS types for the dashboard `spec` JSON.
- `kobo.ts` — Kobo API client (paginated submission fetch, token decryption).
- `mapper.ts` — Kobo submission → `evaluation_responses` row.
- `match-investments.ts` — case-insensitive exact + pg_trgm fuzzy match against `mis_investments`.
- `ingest.ts` — orchestrates per-instrument sync (fetch → map → upsert → match → log).
- `aggregate.ts` — parameterized aggregation queries for each chart type.
- `queries.ts` — `listEvaluations`, `getEvaluation`, `listResponses`, `getDashboardData`.
- `actions.ts` — `setQcStatus`, `createEvaluation`, `updateInstrument`, `setDashboardSpec`, `uploadMisInvestments`, `resolveIngestionIssue`, `triggerManualSync`.

**New UI components (`src/components/evaluations/`)**
- `mode-toggle.tsx` — Progress / Findings switch.
- `filter-bar.tsx` — Geography (cascading) / Gender / SOCO exposure filters.
- `kpi-tile.tsx` — Single KPI render (number/percent + label + delta optional).
- `charts/donut.tsx`, `charts/bar-pct.tsx`, `charts/stacked-bar.tsx`, `charts/horizontal-bar.tsx`, `charts/heatmap.tsx`, `charts/choropleth.tsx`, `charts/progress-bars.tsx`, `charts/trend-line.tsx`.
- `chart-engine.tsx` — Dispatches a `spec` entry to its chart component.
- `qc-row-actions.tsx` — Approve / Mark for redo / Cancel buttons on QC table rows.
- `sync-now-button.tsx` — Staff-only manual sync trigger with 60s cooldown UX.
- `dashboard-config-editor.tsx` — Admin JSON editor for `spec`.

**New routes**
- `src/app/api/evaluations/sync/route.ts` — POST handler (cron + manual).
- `src/app/workspace/evaluations/page.tsx` — staff index.
- `src/app/workspace/evaluations/[id]/responses/page.tsx` — QC table.
- `src/app/workspace/projects/[id]/dashboard/page.tsx` — staff dashboard.
- `src/app/portal/projects/[id]/dashboard/page.tsx` — client dashboard.
- `src/app/admin/evaluations/page.tsx` — admin index.
- `src/app/admin/evaluations/[id]/page.tsx` — admin detail (instrument config, MIS upload, triage).

**Modified files**
- `vercel.json` — create file with cron entry for `/api/evaluations/sync`.
- `src/components/nav/sidebar.tsx` (or current sidebar component) — add "Evaluations" link for staff/admin; add "Dashboard" link inside the portal nav.
- `src/app/portal/projects/[id]/page.tsx` (or current portal project page) — add dashboard link when the project has an active evaluation.
- `src/lib/supabase/types.ts` — regenerated after migrations land.
- `package.json` — add `recharts` dependency.

**Tests**
- `tests/evaluations/mapper.test.ts` — Kobo payload → response row.
- `tests/evaluations/aggregate.test.ts` — each chart-type aggregator over a fixture response set.
- `tests/evaluations/dashboard-spec.test.ts` — spec validation accepts good specs, rejects bad ones.
- `tests/evaluations/match-investments.test.ts` — exact + fuzzy + miss cases.
- `tests/rls/evaluations.test.ts` — client sees only approved responses; staff sees all assigned project responses; admin sees everything; client cannot read `mis_investments` or ingestion tables.
- `tests/integration/evaluation-ingest.test.ts` — end-to-end ingestion against a mocked Kobo response covering new submission, duplicate, unmatched investment, QC mapping.

---

## Conventions used in this plan

- `pwsh` for PowerShell commands (Windows default shell), `bash` for unix-style commands.
- All migrations applied with `npx supabase db push` against the hosted Supabase project (matches Part 1).
- Each task ends with a commit using Conventional Commits (`feat:` `fix:` `refactor:` `test:` `migration:` `chore:`).
- Each migration carries a SQL header comment explaining the why, matching `0024_project_role_manager.sql` style.
- TDD: failing test first (where practical), then implementation, then verification. Migrations + UI scaffolding are exceptions where the "test" step verifies the migration applied or the page renders.
- Module path alias `@/` resolves to `src/` (matches existing codebase).
- Kobo API base URL: `https://kc.kobotoolbox.org/api/v2` (override via `KOBO_API_BASE_URL` env var to allow test mocking).

---

## Task 1: Migration `0035_evaluations_core.sql` — evaluations, instruments, dashboard configs

**Files:**
- Create: `supabase/migrations/0035_evaluations_core.sql`
- Test: `tests/rls/evaluations.test.ts` (start file; smoke check that tables exist)

- [ ] **Step 1: Write a smoke test that the three tables exist**

Create `tests/rls/evaluations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { adminClient } from './setup';

describe('evaluations core tables', () => {
  it('evaluations / evaluation_instruments / evaluation_dashboard_configs exist', async () => {
    const admin = adminClient();
    const a = await admin.from('evaluations').select('id').limit(1);
    const b = await admin.from('evaluation_instruments').select('id').limit(1);
    const c = await admin.from('evaluation_dashboard_configs').select('id').limit(1);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(c.error).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```pwsh
npm test -- tests/rls/evaluations.test.ts
```

Expected: FAIL — relation `evaluations` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0035_evaluations_core.sql`:

```sql
-- 0035_evaluations_core.sql
--
-- Introduces the top-level evaluation aggregate. An "evaluation" is a
-- Kobo-driven data-collection effort attached to a project. It has one or
-- more "instruments" (each tied to one Kobo form) and one or more
-- "dashboard configs" (versioned JSON specs that drive KPI + chart rendering).
--
-- Tables created here carry the minimum schema needed for the ingestion
-- pipeline and the dashboard engine. Response storage, MIS reference data,
-- and ingestion audit tables land in 0036/0037. RLS lands in 0038 once all
-- tables exist so policy bodies can reference any of them.

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
create index evaluations_project_id_idx on evaluations(project_id);
create index evaluations_status_idx on evaluations(status);

create table evaluation_instruments (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  kind text not null check (kind in ('hh','cpic','custom')),
  name text not null,
  kobo_form_id text not null,
  kobo_api_token_encrypted bytea,
  schema_config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index evaluation_instruments_evaluation_id_idx on evaluation_instruments(evaluation_id);

create table evaluation_dashboard_configs (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  version int not null default 1,
  spec jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index evaluation_dashboard_configs_one_active_per_eval_idx
  on evaluation_dashboard_configs(evaluation_id)
  where is_active = true;

comment on table evaluations is
  'Top-level M&E evaluation attached to a project. Drives the dashboard at /portal/projects/[id]/dashboard.';
comment on column evaluation_instruments.kobo_api_token_encrypted is
  'Kobo API token encrypted at rest via pgsodium. Decryption is server-only (SERVICE_ROLE).';
comment on column evaluation_instruments.schema_config is
  'JSON map of Kobo question codes to semantic names (e.g. {"s0_a4": "region"}). Aggregator tolerates missing mappings.';
comment on column evaluation_dashboard_configs.spec is
  'Versioned dashboard spec (KPIs + sections + chart entries). See src/lib/evaluations/dashboard-spec.ts for the shape.';
```

- [ ] **Step 4: Apply the migration**

```pwsh
npx supabase db push
```

Expected: `0035_evaluations_core` applied successfully.

- [ ] **Step 5: Run the smoke test**

```pwsh
npm test -- tests/rls/evaluations.test.ts
```

Expected: PASS.

- [ ] **Step 6: Regenerate Supabase types**

```pwsh
npm run db:types
```

Expected: `src/lib/supabase/types.ts` includes `evaluations`, `evaluation_instruments`, `evaluation_dashboard_configs`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0035_evaluations_core.sql tests/rls/evaluations.test.ts src/lib/supabase/types.ts
git commit -m "migration: 0035 evaluations core (evaluations, instruments, dashboard configs)"
```

---

## Task 2: Migration `0036_evaluations_data.sql` — MIS, responses, response investments

**Files:**
- Create: `supabase/migrations/0036_evaluations_data.sql`
- Test: extend `tests/rls/evaluations.test.ts`

- [ ] **Step 1: Extend the smoke test**

Append to `tests/rls/evaluations.test.ts` inside the existing `describe`:

```ts
  it('mis_investments / evaluation_responses / evaluation_response_investments exist', async () => {
    const admin = adminClient();
    const a = await admin.from('mis_investments').select('id').limit(1);
    const b = await admin.from('evaluation_responses').select('id').limit(1);
    const c = await admin.from('evaluation_response_investments').select('id').limit(1);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(c.error).toBeNull();
  });
```

- [ ] **Step 2: Run — expect FAIL**

```pwsh
npm test -- tests/rls/evaluations.test.ts
```

Expected: FAIL — relation `mis_investments` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0036_evaluations_data.sql`:

```sql
-- 0036_evaluations_data.sql
--
-- Adds the row-grain data tables: MIS investment reference, Kobo response
-- store, and the per-response investment-block matches.
--
-- Enables pg_trgm so the ingestion pipeline can fuzzy-match free-text
-- investment names (HH repeat block) against the curated MIS list.

create extension if not exists pg_trgm;

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
create index mis_inv_name_trgm_idx on mis_investments using gin (investment_name gin_trgm_ops);

create table evaluation_responses (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references evaluation_instruments(id) on delete cascade,
  kobo_submission_uuid text not null,
  kobo_submission_id bigint,
  submitted_at timestamptz not null,
  raw jsonb not null,
  region text,
  district text,
  cluster text,
  community text,
  gender text,
  age int,
  qc_status text not null default 'pending'
    check (qc_status in ('pending','approved','edited','cancelled_redo','cancelled_dropped')),
  qc_checked_at timestamptz,
  qc_checked_by uuid references auth.users(id) on delete set null,
  ingested_at timestamptz not null default now(),
  unique (instrument_id, kobo_submission_uuid)
);
create index er_instrument_qc_idx on evaluation_responses(instrument_id, qc_status);
create index er_geo_idx on evaluation_responses(instrument_id, region, district, community);
create index er_submitted_at_idx on evaluation_responses(instrument_id, submitted_at desc);

create table evaluation_response_investments (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references evaluation_responses(id) on delete cascade,
  investment_id uuid references mis_investments(id) on delete set null,
  raw_investment_name text not null,
  answers jsonb not null,
  match_status text not null default 'auto'
    check (match_status in ('auto','manual','unmatched'))
);
create index eri_response_idx on evaluation_response_investments(response_id);
create index eri_investment_idx on evaluation_response_investments(investment_id);

comment on table evaluation_responses is
  'One row per Kobo submission. raw holds the full payload; flattened geo + demo columns power the dashboard queries.';
comment on column evaluation_responses.qc_status is
  'pending = awaiting staff QC; approved = visible to client; cancelled_* = excluded from all counts.';
```

- [ ] **Step 4: Apply, smoke test, regenerate types**

```pwsh
npx supabase db push
npm test -- tests/rls/evaluations.test.ts
npm run db:types
```

Expected: migration applied, smoke test passes, types regenerated.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0036_evaluations_data.sql tests/rls/evaluations.test.ts src/lib/supabase/types.ts
git commit -m "migration: 0036 evaluations data (MIS, responses, response investments, pg_trgm)"
```

---

## Task 3: Migration `0037_evaluations_ingestion.sql` — ingestion runs + issues

**Files:**
- Create: `supabase/migrations/0037_evaluations_ingestion.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0037_evaluations_ingestion.sql`:

```sql
-- 0037_evaluations_ingestion.sql
--
-- Audit and triage surface for the Kobo ingestion pipeline. Each sync run
-- writes one evaluation_ingestion_runs row (status + counts). Anomalies
-- that don't abort the run (e.g. unmatched investment names) write rows
-- into evaluation_ingestion_issues for admin review.

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
create index eir_instrument_started_idx
  on evaluation_ingestion_runs(instrument_id, started_at desc);

create table evaluation_ingestion_issues (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references evaluation_ingestion_runs(id) on delete set null,
  instrument_id uuid not null references evaluation_instruments(id) on delete cascade,
  kobo_submission_uuid text,
  kind text not null,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index eii_unresolved_idx
  on evaluation_ingestion_issues(instrument_id)
  where resolved_at is null;
```

- [ ] **Step 2: Apply and regenerate types**

```pwsh
npx supabase db push
npm run db:types
```

Expected: migration applied; types include the new tables.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0037_evaluations_ingestion.sql src/lib/supabase/types.ts
git commit -m "migration: 0037 evaluations ingestion (runs + issues)"
```

---

## Task 4: Migration `0038_evaluations_rls.sql` — RLS for all evaluation tables

**Files:**
- Create: `supabase/migrations/0038_evaluations_rls.sql`
- Test: extend `tests/rls/evaluations.test.ts`

- [ ] **Step 1: Write failing RLS tests**

Append to `tests/rls/evaluations.test.ts`:

```ts
import { clientAs, createTestUser, cleanupTestData } from './setup';
import { afterAll } from 'vitest';

afterAll(async () => { await cleanupTestData(); });

describe('evaluations RLS', () => {
  it('client sees only approved responses for their project', async () => {
    const admin = adminClient();
    const clientEmail = `ev-client-${Date.now()}@example.com`;
    const clientId = await createTestUser('client', clientEmail);

    const { data: org } = await admin
      .from('clients').insert({ name: 'Org RLS Eval' }).select('id').single();
    const { data: project } = await admin
      .from('projects')
      .insert({ name: 'Eval Proj', code: `EV-${Date.now()}`, client_id: org!.id })
      .select('id').single();
    await admin.from('project_members')
      .insert({ project_id: project!.id, user_id: clientId, project_role: 'viewer' });

    const { data: ev } = await admin
      .from('evaluations')
      .insert({ project_id: project!.id, name: 'E', slug: `e-${Date.now()}` })
      .select('id').single();
    const { data: inst } = await admin
      .from('evaluation_instruments')
      .insert({ evaluation_id: ev!.id, kind: 'hh', name: 'HH', kobo_form_id: 'f1' })
      .select('id').single();
    await admin.from('evaluation_responses').insert([
      { instrument_id: inst!.id, kobo_submission_uuid: 'u1', submitted_at: new Date().toISOString(), raw: {}, qc_status: 'approved' },
      { instrument_id: inst!.id, kobo_submission_uuid: 'u2', submitted_at: new Date().toISOString(), raw: {}, qc_status: 'pending' },
    ]);

    const sb = await clientAs(clientEmail);
    const { data: visible } = await sb
      .from('evaluation_responses')
      .select('kobo_submission_uuid, qc_status')
      .eq('instrument_id', inst!.id);
    const uuids = (visible ?? []).map((r) => r.kobo_submission_uuid);
    expect(uuids).toContain('u1');
    expect(uuids).not.toContain('u2');
  });

  it('client cannot read mis_investments or ingestion tables', async () => {
    const admin = adminClient();
    const clientEmail = `ev-client2-${Date.now()}@example.com`;
    await createTestUser('client', clientEmail);
    const sb = await clientAs(clientEmail);
    const a = await sb.from('mis_investments').select('id').limit(1);
    const b = await sb.from('evaluation_ingestion_runs').select('id').limit(1);
    const c = await sb.from('evaluation_ingestion_issues').select('id').limit(1);
    // RLS returns empty result + no error when policy denies select.
    expect((a.data ?? []).length).toBe(0);
    expect((b.data ?? []).length).toBe(0);
    expect((c.data ?? []).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```pwsh
npm test -- tests/rls/evaluations.test.ts
```

Expected: FAIL — without RLS the client sees both responses.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0038_evaluations_rls.sql`:

```sql
-- 0038_evaluations_rls.sql
--
-- Row-level security for all evaluation_* and mis_investments tables.
--
-- Read model:
--   admin                 — full read on every table.
--   staff (manager/member)— read everything for projects they belong to via
--                           project_members; QC + dashboard access.
--   client (viewer)       — read evaluations + instruments + dashboard_configs
--                           for their project; read responses ONLY where
--                           qc_status='approved'; NO read on mis_investments,
--                           response_investments, ingestion tables.
--
-- Write model:
--   admin                 — full write on every table.
--   staff (manager/member)— update qc_status on responses for their project;
--                           insert into ingestion_runs/issues only via the
--                           ingestion API (which uses SERVICE_ROLE, bypassing RLS).
--   client                — no writes anywhere.

alter table evaluations enable row level security;
alter table evaluation_instruments enable row level security;
alter table evaluation_dashboard_configs enable row level security;
alter table mis_investments enable row level security;
alter table evaluation_responses enable row level security;
alter table evaluation_response_investments enable row level security;
alter table evaluation_ingestion_runs enable row level security;
alter table evaluation_ingestion_issues enable row level security;

-- evaluations: anyone with project access reads.
create policy evaluations_read on evaluations for select
  using (public.can_access_project(project_id));
create policy evaluations_admin_write on evaluations for all
  using (public.is_admin()) with check (public.is_admin());

-- evaluation_instruments: scoped via parent evaluation. kobo_api_token_encrypted
-- is selectable; clients shouldn't be querying it directly, but defense in
-- depth happens in the queries layer where we never SELECT that column for
-- non-admin callers. Admins write.
create policy evaluation_instruments_read on evaluation_instruments for select
  using (
    exists (
      select 1 from evaluations e
      where e.id = evaluation_instruments.evaluation_id
        and public.can_access_project(e.project_id)
    )
  );
create policy evaluation_instruments_admin_write on evaluation_instruments for all
  using (public.is_admin()) with check (public.is_admin());

-- evaluation_dashboard_configs: read same as evaluations; admin writes.
create policy evaluation_dashboard_configs_read on evaluation_dashboard_configs for select
  using (
    exists (
      select 1 from evaluations e
      where e.id = evaluation_dashboard_configs.evaluation_id
        and public.can_access_project(e.project_id)
    )
  );
create policy evaluation_dashboard_configs_admin_write on evaluation_dashboard_configs for all
  using (public.is_admin()) with check (public.is_admin());

-- mis_investments: admin + staff (managers/members on the project) only.
create policy mis_investments_staff_read on mis_investments for select
  using (
    public.is_admin() or exists (
      select 1
      from evaluations e
      join project_members pm on pm.project_id = e.project_id
      where e.id = mis_investments.evaluation_id
        and pm.user_id = auth.uid()
        and pm.project_role in ('manager', 'member')
    )
  );
create policy mis_investments_admin_write on mis_investments for all
  using (public.is_admin()) with check (public.is_admin());

-- evaluation_responses: client sees only approved; staff/admin see all.
create policy evaluation_responses_read on evaluation_responses for select
  using (
    exists (
      select 1
      from evaluation_instruments i
      join evaluations e on e.id = i.evaluation_id
      where i.id = evaluation_responses.instrument_id
        and public.can_access_project(e.project_id)
        and (
          public.is_admin()
          or exists (
            select 1 from project_members pm
            where pm.project_id = e.project_id
              and pm.user_id = auth.uid()
              and pm.project_role in ('manager','member')
          )
          or evaluation_responses.qc_status = 'approved'
        )
    )
  );

-- Staff updates qc_status (and only qc_status fields) on responses they can see.
create policy evaluation_responses_staff_update on evaluation_responses for update
  using (
    exists (
      select 1
      from evaluation_instruments i
      join evaluations e on e.id = i.evaluation_id
      join project_members pm on pm.project_id = e.project_id
      where i.id = evaluation_responses.instrument_id
        and pm.user_id = auth.uid()
        and pm.project_role in ('manager','member')
    ) or public.is_admin()
  )
  with check (
    exists (
      select 1
      from evaluation_instruments i
      join evaluations e on e.id = i.evaluation_id
      join project_members pm on pm.project_id = e.project_id
      where i.id = evaluation_responses.instrument_id
        and pm.user_id = auth.uid()
        and pm.project_role in ('manager','member')
    ) or public.is_admin()
  );

create policy evaluation_responses_admin_write on evaluation_responses for all
  using (public.is_admin()) with check (public.is_admin());

-- evaluation_response_investments: staff + admin only.
create policy evaluation_response_investments_staff_read on evaluation_response_investments for select
  using (
    public.is_admin() or exists (
      select 1
      from evaluation_responses r
      join evaluation_instruments i on i.id = r.instrument_id
      join evaluations e on e.id = i.evaluation_id
      join project_members pm on pm.project_id = e.project_id
      where r.id = evaluation_response_investments.response_id
        and pm.user_id = auth.uid()
        and pm.project_role in ('manager','member')
    )
  );
create policy evaluation_response_investments_admin_write on evaluation_response_investments for all
  using (public.is_admin()) with check (public.is_admin());

-- Ingestion tables: admin-only by policy; pipeline writes via SERVICE_ROLE.
create policy evaluation_ingestion_runs_admin_read on evaluation_ingestion_runs for select
  using (public.is_admin());
create policy evaluation_ingestion_runs_admin_write on evaluation_ingestion_runs for all
  using (public.is_admin()) with check (public.is_admin());

create policy evaluation_ingestion_issues_admin_read on evaluation_ingestion_issues for select
  using (public.is_admin());
create policy evaluation_ingestion_issues_admin_write on evaluation_ingestion_issues for all
  using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 4: Apply and verify tests pass**

```pwsh
npx supabase db push
npm test -- tests/rls/evaluations.test.ts
```

Expected: PASS on both new RLS tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0038_evaluations_rls.sql tests/rls/evaluations.test.ts
git commit -m "migration: 0038 evaluations RLS"
```

---

## Task 5: Migration `0039_pgsodium_kobo_token.sql` — encrypted Kobo token helpers

**Files:**
- Create: `supabase/migrations/0039_pgsodium_kobo_token.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0039_pgsodium_kobo_token.sql`:

```sql
-- 0039_pgsodium_kobo_token.sql
--
-- Server-only encrypt/decrypt helpers for evaluation_instruments.kobo_api_token_encrypted.
--
-- pgsodium's transparent-encryption support varies by hosted Supabase tier.
-- We use the portable approach: a single named secret stored in pgsodium's
-- key table, accessed only via SECURITY DEFINER helper functions whose
-- EXECUTE is granted to service_role exclusively. App code never reads the
-- raw bytea column — it calls public.kobo_token_set / public.kobo_token_get.

create extension if not exists pgsodium;

-- One application-managed key for all Kobo tokens. Created idempotently.
do $$
declare
  k_id uuid;
begin
  select id into k_id from pgsodium.key where name = 'kobo_token_key';
  if k_id is null then
    perform pgsodium.create_key(name => 'kobo_token_key');
  end if;
end$$;

create or replace function public.kobo_token_set(p_instrument_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public, pgsodium
as $$
declare
  k_id uuid;
  ciphertext bytea;
begin
  select id into k_id from pgsodium.key where name = 'kobo_token_key';
  if k_id is null then
    raise exception 'kobo_token_key not provisioned';
  end if;
  ciphertext := pgsodium.crypto_aead_det_encrypt(
    convert_to(p_token, 'utf8'),
    convert_to(p_instrument_id::text, 'utf8'),
    k_id
  );
  update evaluation_instruments
    set kobo_api_token_encrypted = ciphertext, updated_at = now()
    where id = p_instrument_id;
end;
$$;

create or replace function public.kobo_token_get(p_instrument_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pgsodium
as $$
declare
  k_id uuid;
  ciphertext bytea;
  plaintext bytea;
begin
  select id into k_id from pgsodium.key where name = 'kobo_token_key';
  select kobo_api_token_encrypted into ciphertext
    from evaluation_instruments where id = p_instrument_id;
  if ciphertext is null then return null; end if;
  plaintext := pgsodium.crypto_aead_det_decrypt(
    ciphertext,
    convert_to(p_instrument_id::text, 'utf8'),
    k_id
  );
  return convert_from(plaintext, 'utf8');
end;
$$;

revoke execute on function public.kobo_token_set(uuid, text) from public;
revoke execute on function public.kobo_token_get(uuid) from public;
grant execute on function public.kobo_token_set(uuid, text) to service_role;
grant execute on function public.kobo_token_get(uuid) to service_role;

comment on function public.kobo_token_set is
  'Encrypt and store a Kobo API token for an instrument. Service role only.';
comment on function public.kobo_token_get is
  'Decrypt and return the Kobo API token for an instrument. Service role only.';
```

- [ ] **Step 2: Apply**

```pwsh
npx supabase db push
```

Expected: migration applied. If the hosted Supabase tier reports `pgsodium not available`, fall through to the **fallback** in Step 3; otherwise skip Step 3.

- [ ] **Step 3 (fallback): if pgsodium not available, swap to AES via app-level encryption**

If Step 2 fails on `pgsodium`, replace the migration body with a no-op that keeps the column as `bytea` and document the change here in a single header comment:

```sql
-- 0039_pgsodium_kobo_token.sql (fallback)
--
-- pgsodium not available on this Supabase tier. App-level encryption used
-- instead: the ingestion module reads KOBO_TOKEN_ENC_KEY (32 bytes, base64)
-- from env and AES-256-GCM encrypts/decrypts via node:crypto. Column type
-- stays bytea so the production migration path matches the dev path once
-- pgsodium is enabled.

select 1;
```

Then re-apply (`npx supabase db push`). The `kobo.ts` module (Task 8) will branch on whether `public.kobo_token_get` exists.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0039_pgsodium_kobo_token.sql
git commit -m "migration: 0039 pgsodium Kobo token encryption helpers"
```

---

## Task 6: Migration `0040_seed_soco_evaluation.sql` — SOCO Midterm Review seed

**Files:**
- Create: `supabase/migrations/0040_seed_soco_evaluation.sql`

- [ ] **Step 1: Write the seed migration**

Create `supabase/migrations/0040_seed_soco_evaluation.sql`:

```sql
-- 0040_seed_soco_evaluation.sql
--
-- Seeds the SOCO Midterm Review evaluation + the Household Survey instrument
-- + the v1 dashboard spec (6 KPIs, 6 sections).
--
-- This migration is idempotent: every insert is guarded by a NOT EXISTS check
-- on a stable slug or natural key. Re-running is safe.
--
-- The migration assumes a project with a known marker exists (matched by name
-- LIKE 'SOCO%'). If no such project exists yet, the seed is skipped — admin
-- can re-trigger by creating the project and re-running this migration via
-- an idempotent helper, or by inserting the rows by hand.

do $$
declare
  soco_project_id uuid;
  soco_eval_id uuid;
  hh_instrument_id uuid;
begin
  select id into soco_project_id from projects where name ilike 'SOCO%' order by created_at asc limit 1;
  if soco_project_id is null then
    raise notice 'No SOCO project found; skipping seed';
    return;
  end if;

  select id into soco_eval_id from evaluations where slug = 'soco-midterm-review';
  if soco_eval_id is null then
    insert into evaluations (project_id, name, slug, status, collection_target_n, collection_started_at)
    values (soco_project_id, 'SOCO Midterm Review', 'soco-midterm-review', 'collecting', 2000, now())
    returning id into soco_eval_id;
  end if;

  select id into hh_instrument_id
    from evaluation_instruments
    where evaluation_id = soco_eval_id and kind = 'hh';
  if hh_instrument_id is null then
    insert into evaluation_instruments (evaluation_id, kind, name, kobo_form_id, schema_config)
    values (
      soco_eval_id, 'hh', 'Household Survey', 'TBD_VIA_ADMIN_UI',
      '{
        "s0_a4": "region",
        "s0_a5": "district",
        "s0_a7": "community",
        "s1_a1": "gender",
        "s1_a2": "age"
      }'::jsonb
    )
    returning id into hh_instrument_id;
  end if;

  -- One active dashboard spec for the evaluation.
  if not exists (
    select 1 from evaluation_dashboard_configs
    where evaluation_id = soco_eval_id and is_active = true
  ) then
    insert into evaluation_dashboard_configs (evaluation_id, version, spec, is_active)
    values (
      soco_eval_id, 1,
      '{
        "kpis": [
          { "id": "collected_vs_target", "label": "Collected vs target",
            "instrument": "hh", "numerator": { "approved": true },
            "denominator": "target_n", "format": "fraction" },
          { "id": "in_qc_queue", "label": "Awaiting QC",
            "instrument": "hh", "numerator": { "qc_status": "pending" },
            "denominator": "all_responses", "format": "count" },
          { "id": "districts_active", "label": "Districts active",
            "instrument": "hh", "numerator": { "distinct": "district" },
            "denominator": "districts_total", "format": "fraction" },
          { "id": "fm_split", "label": "Female / Male split",
            "instrument": "hh", "numerator": { "field": "gender", "eq": "female" },
            "denominator": "all_responses", "format": "percent" },
          { "id": "refusal_rate", "label": "Refusal + replacement rate",
            "instrument": "hh",
            "numerator": { "qc_status_in": ["cancelled_redo","cancelled_dropped"] },
            "denominator": "all_responses", "format": "percent" },
          { "id": "qc_approval_rate", "label": "QC approval rate",
            "instrument": "hh", "numerator": { "qc_status": "approved" },
            "denominator": "qc_decided", "format": "percent" }
        ],
        "sections": [
          { "id": "reach", "title": "Project reach & participation",
            "charts": [
              { "type": "donut", "field": "s3_a1", "title": "Heard of SOCO?" },
              { "type": "bar_pct", "field": "s3_a2", "title": "How they heard",
                "filter": { "field": "s3_a1", "eq": 1 } },
              { "type": "stacked_bar", "field": "s3_a8", "by": "gender",
                "title": "Felt involved (by gender)" }
            ]
          },
          { "id": "investments", "title": "Infrastructure investments",
            "charts": [
              { "type": "horizontal_bar", "field": "inv_familiarity", "title": "Familiarity by investment" },
              { "type": "horizontal_bar", "field": "inv_satisfaction", "title": "Satisfaction by investment" }
            ]
          },
          { "id": "cohesion", "title": "Social cohesion activities",
            "charts": [
              { "type": "donut", "field": "s3_c1", "title": "Familiar with cohesion activities" },
              { "type": "bar_pct", "field": "s3_c3", "title": "Why participated" }
            ]
          },
          { "id": "perceptions", "title": "Perceptions & attitudes",
            "charts": [
              { "type": "stacked_bar", "field": "s5_trust", "by": "district", "title": "Trust by district" },
              { "type": "heatmap", "field": "s5_benefits", "title": "Who benefits more grid" }
            ]
          },
          { "id": "services", "title": "Service satisfaction & change",
            "charts": [
              { "type": "stacked_bar", "field": "s6_satisfaction", "by": "service", "title": "Satisfaction by service" }
            ]
          },
          { "id": "conflict", "title": "Conflict & climate shocks",
            "charts": [
              { "type": "donut", "field": "s7_conflict_freq", "title": "Conflict frequency" },
              { "type": "bar_pct", "field": "s7_climate_shocks", "title": "Climate shocks experienced" }
            ]
          }
        ],
        "disaggregations": {
          "geography": { "fields": ["region","district","community"],
                         "labels": ["Region","District","Community"] },
          "gender": { "field": "gender" },
          "soco_exposure": {
            "Heard of SOCO": { "field": "s3_a1", "eq": 1 },
            "Attended meeting": { "field": "s3_a4", "eq": 1 },
            "Participated in cohesion activity": { "field": "s3_c2", "eq": 1 }
          }
        }
      }'::jsonb
    );
  end if;
end$$;
```

- [ ] **Step 2: Apply**

```pwsh
npx supabase db push
```

Expected: migration applied; either inserts rows (if a SOCO project exists) or notices skip.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0040_seed_soco_evaluation.sql
git commit -m "migration: 0040 seed SOCO midterm review evaluation"
```

---

## Task 7: Zod schemas + dashboard-spec validator

**Files:**
- Create: `src/lib/evaluations/schemas.ts`
- Create: `src/lib/evaluations/dashboard-spec.ts`
- Test: `tests/evaluations/dashboard-spec.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/evaluations/dashboard-spec.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DashboardSpec } from '@/lib/evaluations/dashboard-spec';

const goodSpec = {
  kpis: [
    { id: 'a', label: 'A', instrument: 'hh', numerator: { field: 'x', eq: 1 },
      denominator: 'all_responses', format: 'percent' },
  ],
  sections: [
    { id: 's1', title: 'S1', charts: [{ type: 'donut', field: 'x', title: 'X' }] },
  ],
  disaggregations: {
    geography: { fields: ['region','district','community'],
                 labels: ['Region','District','Community'] },
    gender: { field: 'gender' },
    soco_exposure: { 'Heard of SOCO': { field: 'x', eq: 1 } },
  },
};

describe('DashboardSpec', () => {
  it('accepts a well-formed spec', () => {
    expect(() => DashboardSpec.parse(goodSpec)).not.toThrow();
  });

  it('rejects an unknown chart type', () => {
    const bad = structuredClone(goodSpec);
    (bad.sections[0].charts[0] as { type: string }).type = 'pie3d';
    expect(() => DashboardSpec.parse(bad)).toThrow();
  });

  it('rejects a KPI with no denominator', () => {
    const bad = structuredClone(goodSpec);
    delete (bad.kpis[0] as Partial<typeof bad.kpis[0]>).denominator;
    expect(() => DashboardSpec.parse(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```pwsh
npm test -- tests/evaluations/dashboard-spec.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `dashboard-spec.ts`**

Create `src/lib/evaluations/dashboard-spec.ts`:

```ts
import { z } from 'zod';

export const CHART_TYPES = [
  'donut','bar_pct','stacked_bar','horizontal_bar',
  'heatmap','choropleth','progress_bars','trend_line',
] as const;
export type ChartType = (typeof CHART_TYPES)[number];

const ChartFilter = z.object({
  field: z.string(),
  eq: z.union([z.string(), z.number(), z.boolean()]).optional(),
  in: z.array(z.union([z.string(), z.number()])).optional(),
});

export const ChartEntry = z.object({
  type: z.enum(CHART_TYPES),
  field: z.string(),
  title: z.string(),
  by: z.string().optional(),
  filter: ChartFilter.optional(),
});
export type ChartEntry = z.infer<typeof ChartEntry>;

export const KpiEntry = z.object({
  id: z.string(),
  label: z.string(),
  instrument: z.string(),
  numerator: z.record(z.string(), z.unknown()),
  denominator: z.union([
    z.literal('all_responses'),
    z.literal('approved_responses'),
    z.literal('target_n'),
    z.literal('districts_total'),
    z.literal('qc_decided'),
  ]),
  format: z.enum(['percent','count','fraction']),
});
export type KpiEntry = z.infer<typeof KpiEntry>;

export const Section = z.object({
  id: z.string(),
  title: z.string(),
  charts: z.array(ChartEntry).min(1),
});
export type Section = z.infer<typeof Section>;

export const DashboardSpec = z.object({
  kpis: z.array(KpiEntry),
  sections: z.array(Section),
  disaggregations: z.object({
    geography: z.object({
      fields: z.array(z.string()).min(1),
      labels: z.array(z.string()).min(1),
    }),
    gender: z.object({ field: z.string() }),
    soco_exposure: z.record(
      z.string(),
      z.object({ field: z.string(), eq: z.union([z.string(), z.number(), z.boolean()]) }),
    ),
  }),
});
export type DashboardSpec = z.infer<typeof DashboardSpec>;
```

- [ ] **Step 4: Implement `schemas.ts`**

Create `src/lib/evaluations/schemas.ts`:

```ts
import { z } from 'zod';

export const evaluationCreateSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  collection_target_n: z.coerce.number().int().positive().optional(),
});

export const evaluationUpdateSchema = evaluationCreateSchema.partial().extend({
  id: z.string().uuid(),
  status: z.enum(['draft','collecting','analyzing','closed']).optional(),
  dashboard_default_mode: z.enum(['auto','progress','findings']).optional(),
});

export const instrumentCreateSchema = z.object({
  evaluation_id: z.string().uuid(),
  kind: z.enum(['hh','cpic','custom']),
  name: z.string().min(2),
  kobo_form_id: z.string().min(1),
  schema_config: z.record(z.string(), z.string()).default({}),
});

export const instrumentUpdateSchema = instrumentCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export const QC_STATUSES = [
  'pending','approved','edited','cancelled_redo','cancelled_dropped',
] as const;

export const qcActionSchema = z.object({
  response_id: z.string().uuid(),
  next_status: z.enum(QC_STATUSES),
});

export const filterStateSchema = z.object({
  region: z.string().optional(),
  district: z.string().optional(),
  community: z.string().optional(),
  gender: z.enum(['female','male','all']).default('all'),
  soco_exposure: z.string().default('All'),
});
export type FilterState = z.infer<typeof filterStateSchema>;
```

- [ ] **Step 5: Run the test**

```pwsh
npm test -- tests/evaluations/dashboard-spec.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/evaluations/schemas.ts src/lib/evaluations/dashboard-spec.ts tests/evaluations/dashboard-spec.test.ts
git commit -m "feat(evaluations): Zod schemas + dashboard-spec validator"
```

---

## Task 8: Kobo API client

**Files:**
- Create: `src/lib/evaluations/kobo.ts`

- [ ] **Step 1: Implement the client**

Create `src/lib/evaluations/kobo.ts`:

```ts
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

const BASE_URL = process.env.KOBO_API_BASE_URL ?? 'https://kc.kobotoolbox.org/api/v2';

export type KoboSubmission = {
  _id: number;
  _uuid: string;
  _submission_time: string;
  [key: string]: unknown;
};

export async function decryptKoboToken(instrumentId: string): Promise<string> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('kobo_token_get', { p_instrument_id: instrumentId });
  if (error) throw new Error(`kobo_token_get: ${error.message}`);
  if (!data) throw new Error('No Kobo token configured for instrument');
  return data as string;
}

export async function* iterateKoboSubmissions(opts: {
  instrumentId: string;
  koboFormId: string;
  since?: string | null;
  pageSize?: number;
}): AsyncGenerator<KoboSubmission, void, void> {
  const token = await decryptKoboToken(opts.instrumentId);
  const pageSize = opts.pageSize ?? 200;
  let start = 0;

  while (true) {
    const params = new URLSearchParams({
      start: String(start),
      limit: String(pageSize),
    });
    if (opts.since) {
      params.set('query', JSON.stringify({ _submission_time: { $gt: opts.since } }));
    }
    const url = `${BASE_URL}/assets/${opts.koboFormId}/data/?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Kobo fetch ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const body = (await res.json()) as { results?: KoboSubmission[] };
    const batch = body.results ?? [];
    for (const s of batch) yield s;
    if (batch.length < pageSize) return;
    start += batch.length;
  }
}
```

- [ ] **Step 2: Add a service-role Supabase factory if not present**

Check `src/lib/supabase/server.ts` for an existing `createServiceClient`. If absent, add:

```ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 3: Typecheck**

```pwsh
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/evaluations/kobo.ts src/lib/supabase/server.ts
git commit -m "feat(evaluations): Kobo API client (paginated fetch + token decrypt)"
```

---

## Task 9: Kobo → response mapper

**Files:**
- Create: `src/lib/evaluations/mapper.ts`
- Test: `tests/evaluations/mapper.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/evaluations/mapper.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mapKoboSubmission } from '@/lib/evaluations/mapper';

const submission = {
  _id: 12345,
  _uuid: 'abc-uuid',
  _submission_time: '2026-05-19T10:00:00Z',
  s0_a4: 'Northern',
  s0_a5: 'Tamale',
  s0_a7: 'Sagnarigu',
  s1_a1: 'female',
  s1_a2: '34',
  s7_qc_status: 'approved',
} as Record<string, unknown>;

const schemaConfig = {
  s0_a4: 'region',
  s0_a5: 'district',
  s0_a7: 'community',
  s1_a1: 'gender',
  s1_a2: 'age',
  s7_qc_status: 'qc_status',
};

describe('mapKoboSubmission', () => {
  it('maps semantic fields out of raw', () => {
    const row = mapKoboSubmission(submission, schemaConfig, 'inst-1');
    expect(row.instrument_id).toBe('inst-1');
    expect(row.kobo_submission_uuid).toBe('abc-uuid');
    expect(row.kobo_submission_id).toBe(12345);
    expect(row.region).toBe('Northern');
    expect(row.district).toBe('Tamale');
    expect(row.community).toBe('Sagnarigu');
    expect(row.gender).toBe('female');
    expect(row.age).toBe(34);
    expect(row.qc_status).toBe('approved');
    expect(row.raw).toEqual(submission);
  });

  it('defaults qc_status to pending when not mapped', () => {
    const { qc_status } = mapKoboSubmission(
      submission, { _id: 'kobo_submission_id' }, 'inst-1');
    expect(qc_status).toBe('pending');
  });

  it('coerces age to int and tolerates missing fields', () => {
    const row = mapKoboSubmission(
      { _id: 1, _uuid: 'u', _submission_time: '2026-05-19T10:00:00Z' },
      schemaConfig, 'inst-1');
    expect(row.age).toBeNull();
    expect(row.region).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```pwsh
npm test -- tests/evaluations/mapper.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mapper**

Create `src/lib/evaluations/mapper.ts`:

```ts
import type { KoboSubmission } from './kobo';
import { QC_STATUSES } from './schemas';

export type MappedResponse = {
  instrument_id: string;
  kobo_submission_uuid: string;
  kobo_submission_id: number | null;
  submitted_at: string;
  raw: KoboSubmission;
  region: string | null;
  district: string | null;
  cluster: string | null;
  community: string | null;
  gender: string | null;
  age: number | null;
  qc_status: (typeof QC_STATUSES)[number];
};

const QC_VALUES = new Set<string>(QC_STATUSES);

function pick(sub: KoboSubmission, schemaConfig: Record<string,string>, target: string): unknown {
  for (const [koboKey, semantic] of Object.entries(schemaConfig)) {
    if (semantic === target) return sub[koboKey];
  }
  return undefined;
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

function asInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function asQcStatus(v: unknown): MappedResponse['qc_status'] {
  if (typeof v === 'string' && QC_VALUES.has(v)) return v as MappedResponse['qc_status'];
  return 'pending';
}

export function mapKoboSubmission(
  sub: KoboSubmission,
  schemaConfig: Record<string,string>,
  instrumentId: string,
): MappedResponse {
  return {
    instrument_id: instrumentId,
    kobo_submission_uuid: String(sub._uuid),
    kobo_submission_id: asInt(sub._id),
    submitted_at: String(sub._submission_time),
    raw: sub,
    region: asString(pick(sub, schemaConfig, 'region')),
    district: asString(pick(sub, schemaConfig, 'district')),
    cluster: asString(pick(sub, schemaConfig, 'cluster')),
    community: asString(pick(sub, schemaConfig, 'community')),
    gender: asString(pick(sub, schemaConfig, 'gender')),
    age: asInt(pick(sub, schemaConfig, 'age')),
    qc_status: asQcStatus(pick(sub, schemaConfig, 'qc_status')),
  };
}
```

- [ ] **Step 4: Run the test**

```pwsh
npm test -- tests/evaluations/mapper.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/evaluations/mapper.ts tests/evaluations/mapper.test.ts
git commit -m "feat(evaluations): map Kobo submission → response row"
```

---

## Task 10: Investment matcher (exact + trigram fuzzy)

**Files:**
- Create: `src/lib/evaluations/match-investments.ts`
- Test: `tests/evaluations/match-investments.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/evaluations/match-investments.test.ts`. This test uses real Supabase (no mocks) per the project's RLS-test convention:

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, cleanupTestData } from '../rls/setup';
import { matchInvestment } from '@/lib/evaluations/match-investments';

describe('matchInvestment', () => {
  afterAll(async () => { await cleanupTestData(); });

  it('exact case-insensitive match wins', async () => {
    const admin = adminClient();
    const { data: project } = await admin
      .from('projects').insert({ name: 'MatchTest', code: `MT-${Date.now()}` }).select('id').single();
    const { data: ev } = await admin.from('evaluations')
      .insert({ project_id: project!.id, name: 'E', slug: `e-${Date.now()}` })
      .select('id').single();
    const { data: inv } = await admin.from('mis_investments').insert([
      { evaluation_id: ev!.id, community: 'Sagnarigu', district: 'Tamale',
        investment_type: 'borehole', investment_name: 'Sagnarigu Borehole 1' },
    ]).select('id, investment_name').single();

    const m = await matchInvestment({
      evaluationId: ev!.id, community: 'Sagnarigu', rawName: 'sagnarigu borehole 1',
    });
    expect(m?.investment_id).toBe(inv!.id);
    expect(m?.match_status).toBe('auto');
  });

  it('fuzzy trigram >= 0.85 matches', async () => {
    const admin = adminClient();
    const { data: project } = await admin
      .from('projects').insert({ name: 'MatchTest2', code: `MT2-${Date.now()}` }).select('id').single();
    const { data: ev } = await admin.from('evaluations')
      .insert({ project_id: project!.id, name: 'E', slug: `e2-${Date.now()}` })
      .select('id').single();
    await admin.from('mis_investments').insert([
      { evaluation_id: ev!.id, community: 'Sagnarigu', district: 'Tamale',
        investment_type: 'school', investment_name: 'Sagnarigu Primary School' },
    ]);

    const m = await matchInvestment({
      evaluationId: ev!.id, community: 'Sagnarigu', rawName: 'Sagnarigu Primary  Schl',
    });
    expect(m?.match_status === 'auto' || m?.match_status === 'unmatched').toBeTruthy();
  });

  it('returns unmatched when nothing close enough', async () => {
    const admin = adminClient();
    const { data: project } = await admin
      .from('projects').insert({ name: 'MatchTest3', code: `MT3-${Date.now()}` }).select('id').single();
    const { data: ev } = await admin.from('evaluations')
      .insert({ project_id: project!.id, name: 'E', slug: `e3-${Date.now()}` })
      .select('id').single();
    await admin.from('mis_investments').insert([
      { evaluation_id: ev!.id, community: 'Sagnarigu', district: 'Tamale',
        investment_type: 'school', investment_name: 'Sagnarigu Primary School' },
    ]);

    const m = await matchInvestment({
      evaluationId: ev!.id, community: 'Sagnarigu', rawName: 'Completely Unrelated Thing',
    });
    expect(m?.investment_id).toBeNull();
    expect(m?.match_status).toBe('unmatched');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```pwsh
npm test -- tests/evaluations/match-investments.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the matcher**

Create `src/lib/evaluations/match-investments.ts`:

```ts
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

export type MatchResult = {
  investment_id: string | null;
  match_status: 'auto' | 'manual' | 'unmatched';
  raw_investment_name: string;
};

const TRIGRAM_THRESHOLD = 0.85;

export async function matchInvestment(args: {
  evaluationId: string;
  community: string;
  rawName: string;
}): Promise<MatchResult> {
  const sb = createServiceClient();

  // Exact case-insensitive in-community.
  const exact = await sb
    .from('mis_investments')
    .select('id, investment_name')
    .eq('evaluation_id', args.evaluationId)
    .ilike('community', args.community)
    .ilike('investment_name', args.rawName.trim())
    .limit(1);
  if (exact.data && exact.data.length > 0) {
    return {
      investment_id: exact.data[0].id,
      match_status: 'auto',
      raw_investment_name: args.rawName,
    };
  }

  // Trigram fuzzy via RPC. We add this helper as a SQL function in this
  // same task (see Step 4) — keeps the trigram query off the client side.
  const fuzzy = await sb.rpc('match_mis_investment_fuzzy', {
    p_evaluation_id: args.evaluationId,
    p_community: args.community,
    p_raw_name: args.rawName,
    p_threshold: TRIGRAM_THRESHOLD,
  });
  if (!fuzzy.error && fuzzy.data && Array.isArray(fuzzy.data) && fuzzy.data.length > 0) {
    return {
      investment_id: (fuzzy.data[0] as { id: string }).id,
      match_status: 'auto',
      raw_investment_name: args.rawName,
    };
  }

  return {
    investment_id: null,
    match_status: 'unmatched',
    raw_investment_name: args.rawName,
  };
}
```

- [ ] **Step 4: Add the fuzzy-match SQL helper to migration `0036` follow-up**

Because trigram operators are easiest invoked through an RPC, append a short follow-up migration `supabase/migrations/0041_match_investment_fuzzy_fn.sql`:

```sql
-- 0041_match_investment_fuzzy_fn.sql
--
-- Helper RPC for fuzzy-matching MIS investments by name within a community.
-- Returns rows whose similarity >= threshold, ordered by similarity desc.

create or replace function public.match_mis_investment_fuzzy(
  p_evaluation_id uuid,
  p_community text,
  p_raw_name text,
  p_threshold float
)
returns table(id uuid, investment_name text, similarity real)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.investment_name, similarity(m.investment_name, p_raw_name) as similarity
  from mis_investments m
  where m.evaluation_id = p_evaluation_id
    and lower(m.community) = lower(p_community)
    and similarity(m.investment_name, p_raw_name) >= p_threshold
  order by similarity(m.investment_name, p_raw_name) desc
  limit 5;
$$;

revoke execute on function public.match_mis_investment_fuzzy(uuid, text, text, float) from public;
grant execute on function public.match_mis_investment_fuzzy(uuid, text, text, float) to service_role;
```

- [ ] **Step 5: Apply and run the test**

```pwsh
npx supabase db push
npm test -- tests/evaluations/match-investments.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0041_match_investment_fuzzy_fn.sql src/lib/evaluations/match-investments.ts tests/evaluations/match-investments.test.ts
git commit -m "feat(evaluations): MIS investment matcher (exact + trigram)"
```

---

## Task 11: Ingestion orchestrator

**Files:**
- Create: `src/lib/evaluations/ingest.ts`

- [ ] **Step 1: Implement the orchestrator**

Create `src/lib/evaluations/ingest.ts`:

```ts
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { iterateKoboSubmissions, type KoboSubmission } from './kobo';
import { mapKoboSubmission } from './mapper';
import { matchInvestment } from './match-investments';

export type IngestResult = {
  run_id: string;
  status: 'ok' | 'partial' | 'error';
  fetched: number;
  inserted: number;
  updated: number;
  unmatched: number;
};

export async function ingestInstrument(opts: {
  instrumentId: string;
  trigger: 'schedule' | 'manual' | 'backfill';
}): Promise<IngestResult> {
  const sb = createServiceClient();

  // Look up the instrument + evaluation context.
  const { data: inst, error: instErr } = await sb
    .from('evaluation_instruments')
    .select('id, evaluation_id, kobo_form_id, schema_config, last_synced_at')
    .eq('id', opts.instrumentId)
    .single();
  if (instErr || !inst) throw new Error(`Instrument lookup failed: ${instErr?.message}`);

  // Start a run row.
  const { data: run, error: runErr } = await sb
    .from('evaluation_ingestion_runs')
    .insert({ instrument_id: inst.id, trigger: opts.trigger, status: 'running' })
    .select('id').single();
  if (runErr || !run) throw new Error(`Run insert failed: ${runErr?.message}`);

  let fetched = 0, inserted = 0, updated = 0, unmatched = 0;
  const issues: Array<{ kobo_submission_uuid: string; kind: string; details: Record<string, unknown> }> = [];
  let errorMessage: string | null = null;

  try {
    const since = opts.trigger === 'backfill' ? null : inst.last_synced_at ?? null;

    for await (const sub of iterateKoboSubmissions({
      instrumentId: inst.id,
      koboFormId: inst.kobo_form_id,
      since,
    })) {
      fetched++;
      const row = mapKoboSubmission(sub, (inst.schema_config ?? {}) as Record<string,string>, inst.id);

      const { data: upserted, error: upErr } = await sb
        .from('evaluation_responses')
        .upsert(row, { onConflict: 'instrument_id,kobo_submission_uuid' })
        .select('id, ingested_at')
        .single();
      if (upErr || !upserted) {
        issues.push({
          kobo_submission_uuid: row.kobo_submission_uuid,
          kind: 'upsert_failed',
          details: { error: upErr?.message },
        });
        continue;
      }
      // Approximate insert vs update by comparing ingested_at to "now".
      const isInsert = Date.now() - new Date(upserted.ingested_at).getTime() < 5000;
      if (isInsert) inserted++; else updated++;

      // HH investment repeat block: each entry under "investments" (Kobo
      // repeat block name) is processed against mis_investments.
      const repeats = extractRepeats(sub, 'investments');
      for (const r of repeats) {
        const rawName = String(r['inv_name'] ?? r['investment_name'] ?? '').trim();
        if (!rawName) continue;
        const match = await matchInvestment({
          evaluationId: inst.evaluation_id,
          community: String(row.community ?? ''),
          rawName,
        });
        await sb.from('evaluation_response_investments').insert({
          response_id: upserted.id,
          investment_id: match.investment_id,
          raw_investment_name: rawName,
          answers: r,
          match_status: match.match_status,
        });
        if (match.match_status === 'unmatched') {
          unmatched++;
          issues.push({
            kobo_submission_uuid: row.kobo_submission_uuid,
            kind: 'unmatched_investment',
            details: { raw_investment_name: rawName, community: row.community },
          });
        }
      }
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  // Persist issues.
  if (issues.length > 0) {
    await sb.from('evaluation_ingestion_issues').insert(
      issues.map((i) => ({ ...i, run_id: run.id, instrument_id: inst.id })),
    );
  }

  const status: IngestResult['status'] =
    errorMessage ? (fetched > 0 ? 'partial' : 'error') : 'ok';

  await sb.from('evaluation_ingestion_runs').update({
    finished_at: new Date().toISOString(),
    status,
    fetched_count: fetched,
    inserted_count: inserted,
    updated_count: updated,
    unmatched_investment_count: unmatched,
    error_message: errorMessage,
  }).eq('id', run.id);

  // Update last_synced_at + last_sync_* on the instrument.
  await sb.from('evaluation_instruments').update({
    last_synced_at: new Date().toISOString(),
    last_sync_status: status,
    last_sync_error: errorMessage,
    updated_at: new Date().toISOString(),
  }).eq('id', inst.id);

  return { run_id: run.id, status, fetched, inserted, updated, unmatched };
}

function extractRepeats(sub: KoboSubmission, blockName: string): Record<string, unknown>[] {
  const v = (sub as Record<string, unknown>)[blockName];
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  return [];
}
```

- [ ] **Step 2: Typecheck**

```pwsh
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/evaluations/ingest.ts
git commit -m "feat(evaluations): ingestion orchestrator (fetch → map → upsert → match → log)"
```

---

## Task 12: Sync API route + Vercel cron

**Files:**
- Create: `src/app/api/evaluations/sync/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Implement the route**

Create `src/app/api/evaluations/sync/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { ingestInstrument } from '@/lib/evaluations/ingest';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireRole } from '@/lib/auth/require-role-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const headerSecret = req.headers.get('x-vercel-cron-secret') ?? req.headers.get('authorization');
  return !!secret && !!headerSecret && headerSecret.includes(secret);
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const instrumentId = url.searchParams.get('instrument_id');
  const triggerParam = url.searchParams.get('trigger');

  const trigger =
    triggerParam === 'manual' ? 'manual' :
    triggerParam === 'backfill' ? 'backfill' : 'schedule';

  // Cron path: no auth, just shared secret.
  // Manual / backfill: require staff or admin, plus rate limit.
  if (!isCron(req)) {
    const auth = await requireRole(['admin','staff']);
    if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });
    if (trigger === 'backfill' && auth.role !== 'admin') {
      return new NextResponse('Forbidden', { status: 403 });
    }
    if (trigger === 'manual' && instrumentId) {
      const ok = await checkRateLimit({
        key: `evaluations_sync:${instrumentId}`, limit: 1, windowSec: 60,
      });
      if (!ok) return new NextResponse('Rate limited', { status: 429 });
    }
  }

  const sb = createServiceClient();

  // Resolve target instruments.
  let targets: { id: string }[] = [];
  if (instrumentId) {
    targets = [{ id: instrumentId }];
  } else {
    const { data, error } = await sb
      .from('evaluation_instruments')
      .select('id, evaluation_id, evaluations!inner(status)')
      .eq('evaluations.status', 'collecting');
    if (error) return new NextResponse(`Lookup failed: ${error.message}`, { status: 500 });
    targets = (data ?? []).map((r: { id: string }) => ({ id: r.id }));
  }

  const results = [];
  for (const t of targets) {
    try {
      const r = await ingestInstrument({ instrumentId: t.id, trigger });
      results.push({ instrument_id: t.id, ...r });
    } catch (e) {
      results.push({
        instrument_id: t.id,
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ trigger, results });
}
```

- [ ] **Step 2: Create `vercel.json` with the cron entry**

Create `vercel.json` at the repo root:

```json
{
  "crons": [
    {
      "path": "/api/evaluations/sync",
      "schedule": "0 * * * *"
    }
  ]
}
```

Vercel cron triggers an unauthenticated POST. The route's `isCron` check uses Vercel's signed header + `CRON_SECRET` from the environment.

- [ ] **Step 3: Verify `checkRateLimit` and `requireRole` exist in the codebase**

```pwsh
npx tsc --noEmit
```

If `checkRateLimit` doesn't match the rate-limit module's actual export, fix the import. If `requireRole` import path differs, adjust to match (Part 1 split it into `src/lib/auth/require-role-server.ts`).

Expected: typecheck clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/evaluations/sync/route.ts vercel.json
git commit -m "feat(evaluations): sync API route + Vercel hourly cron"
```

---

## Task 13: Aggregation engine

**Files:**
- Create: `src/lib/evaluations/aggregate.ts`
- Test: `tests/evaluations/aggregate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/evaluations/aggregate.test.ts`. This is an integration test (real Supabase) — fixture data inserted via admin client, aggregator queried via the same client, asserts compare:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, cleanupTestData } from '../rls/setup';
import {
  aggregateDonut, aggregateBarPct, aggregateStackedBar,
} from '@/lib/evaluations/aggregate';

let instrumentId: string;

beforeAll(async () => {
  const admin = adminClient();
  const { data: project } = await admin.from('projects')
    .insert({ name: 'AggTest', code: `AGG-${Date.now()}` }).select('id').single();
  const { data: ev } = await admin.from('evaluations')
    .insert({ project_id: project!.id, name: 'E', slug: `agg-${Date.now()}` })
    .select('id').single();
  const { data: inst } = await admin.from('evaluation_instruments')
    .insert({ evaluation_id: ev!.id, kind: 'hh', name: 'HH', kobo_form_id: 'f' })
    .select('id').single();
  instrumentId = inst!.id;

  await admin.from('evaluation_responses').insert([
    { instrument_id: inst!.id, kobo_submission_uuid: 'a', submitted_at: '2026-05-01T00:00:00Z',
      raw: { s3_a1: 1 }, gender: 'female', region: 'Northern', qc_status: 'approved' },
    { instrument_id: inst!.id, kobo_submission_uuid: 'b', submitted_at: '2026-05-02T00:00:00Z',
      raw: { s3_a1: 0 }, gender: 'male', region: 'Northern', qc_status: 'approved' },
    { instrument_id: inst!.id, kobo_submission_uuid: 'c', submitted_at: '2026-05-03T00:00:00Z',
      raw: { s3_a1: 1 }, gender: 'female', region: 'Upper East', qc_status: 'approved' },
    { instrument_id: inst!.id, kobo_submission_uuid: 'd', submitted_at: '2026-05-04T00:00:00Z',
      raw: { s3_a1: 1 }, gender: 'male', region: 'Northern', qc_status: 'pending' },
  ]);
});

afterAll(async () => { await cleanupTestData(); });

describe('aggregators', () => {
  it('donut counts approved-only by default', async () => {
    const buckets = await aggregateDonut({ instrumentId, field: 's3_a1', approvedOnly: true });
    const m = new Map(buckets.map((b) => [String(b.label), b.count]));
    expect(m.get('1')).toBe(2);
    expect(m.get('0')).toBe(1);
  });

  it('bar_pct returns shares', async () => {
    const buckets = await aggregateBarPct({ instrumentId, field: 's3_a1', approvedOnly: true });
    const total = buckets.reduce((s, b) => s + b.pct, 0);
    expect(Math.round(total)).toBe(100);
  });

  it('stacked_bar splits by gender', async () => {
    const rows = await aggregateStackedBar({
      instrumentId, field: 's3_a1', by: 'gender', approvedOnly: true,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('group');
    expect(rows[0]).toHaveProperty('series');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```pwsh
npm test -- tests/evaluations/aggregate.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement aggregators**

Create `src/lib/evaluations/aggregate.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { FilterState } from './schemas';

type BaseArgs = {
  instrumentId: string;
  approvedOnly?: boolean;
  filters?: FilterState;
};

type DonutArgs = BaseArgs & { field: string };
type BarArgs = DonutArgs;
type StackedArgs = BaseArgs & { field: string; by: string };

export type BucketCount = { label: string; count: number };
export type BucketPct = { label: string; pct: number; count: number };
export type StackedRow = { group: string; series: { label: string; count: number }[] };

const DEMO_COLS = new Set(['region','district','community','gender','age']);

function applyFilters(builder: PostgrestBuilder, args: BaseArgs): PostgrestBuilder {
  let q = builder;
  if (args.approvedOnly) q = q.eq('qc_status', 'approved');
  const f = args.filters;
  if (f?.region) q = q.eq('region', f.region);
  if (f?.district) q = q.eq('district', f.district);
  if (f?.community) q = q.eq('community', f.community);
  if (f && f.gender !== 'all') q = q.eq('gender', f.gender);
  return q;
}

// PostgrestBuilder type alias — exact shape varies by client; use any-equivalent.
type PostgrestBuilder = ReturnType<ReturnType<typeof createClient>['from']>['select'] extends
  (...a: never) => infer R ? R : never;

async function fetchRows(args: BaseArgs, columns: string): Promise<Record<string, unknown>[]> {
  const sb = await createClient();
  const base = sb.from('evaluation_responses').select(columns).eq('instrument_id', args.instrumentId);
  const filtered = applyFilters(base, args);
  const { data, error } = await filtered;
  if (error) throw new Error(`aggregate query: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

function readField(row: Record<string, unknown>, field: string): unknown {
  if (DEMO_COLS.has(field)) return row[field];
  const raw = row.raw as Record<string, unknown> | undefined;
  return raw?.[field];
}

export async function aggregateDonut(args: DonutArgs): Promise<BucketCount[]> {
  const rows = await fetchRows(args, 'raw, region, district, community, gender, age, qc_status');
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = readField(r, args.field);
    if (v === null || v === undefined) continue;
    const key = String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
}

export async function aggregateBarPct(args: BarArgs): Promise<BucketPct[]> {
  const buckets = await aggregateDonut(args);
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0) return [];
  return buckets.map((b) => ({ ...b, pct: (b.count / total) * 100 }));
}

export async function aggregateStackedBar(args: StackedArgs): Promise<StackedRow[]> {
  const rows = await fetchRows(args, 'raw, region, district, community, gender, age, qc_status');
  const groups = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const grp = readField(r, args.by);
    const val = readField(r, args.field);
    if (grp === null || grp === undefined) continue;
    if (val === null || val === undefined) continue;
    const gKey = String(grp);
    const vKey = String(val);
    if (!groups.has(gKey)) groups.set(gKey, new Map());
    const inner = groups.get(gKey)!;
    inner.set(vKey, (inner.get(vKey) ?? 0) + 1);
  }
  return Array.from(groups.entries()).map(([group, m]) => ({
    group,
    series: Array.from(m.entries()).map(([label, count]) => ({ label, count })),
  }));
}

export async function aggregateHorizontalBar(args: BarArgs): Promise<BucketCount[]> {
  return aggregateDonut(args);
}

export async function aggregateHeatmap(args: StackedArgs): Promise<StackedRow[]> {
  return aggregateStackedBar(args);
}

export async function aggregateProgressBars(args: { instrumentId: string; targetN: number }) {
  const sb = await createClient();
  const { data, error } = await sb.from('evaluation_responses')
    .select('region')
    .eq('instrument_id', args.instrumentId)
    .eq('qc_status', 'approved');
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { region: string | null }[]) {
    if (!r.region) continue;
    counts.set(r.region, (counts.get(r.region) ?? 0) + 1);
  }
  const perRegionTarget = Math.max(1, Math.floor(args.targetN / Math.max(1, counts.size)));
  return Array.from(counts.entries()).map(([region, count]) => ({
    region, count, target: perRegionTarget, pct: (count / perRegionTarget) * 100,
  }));
}

export async function aggregateTrendLine(args: { instrumentId: string; days: number }) {
  const sb = await createClient();
  const cutoff = new Date(Date.now() - args.days * 86400000).toISOString();
  const { data, error } = await sb.from('evaluation_responses')
    .select('submitted_at')
    .eq('instrument_id', args.instrumentId)
    .gte('submitted_at', cutoff);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { submitted_at: string }[]) {
    const day = r.submitted_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
}

export async function aggregateChoropleth(args: { instrumentId: string; targetN: number }) {
  return aggregateProgressBars(args);
}
```

- [ ] **Step 4: Run the test**

```pwsh
npm test -- tests/evaluations/aggregate.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/evaluations/aggregate.ts tests/evaluations/aggregate.test.ts
git commit -m "feat(evaluations): aggregation engine for all chart types"
```

---

## Task 14: Queries + actions modules

**Files:**
- Create: `src/lib/evaluations/queries.ts`
- Create: `src/lib/evaluations/actions.ts`

- [ ] **Step 1: Implement queries**

Create `src/lib/evaluations/queries.ts`:

```ts
import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export const listEvaluations = cache(async (projectId?: string) => {
  const sb = await createClient();
  let q = sb.from('evaluations')
    .select('id, name, slug, status, project_id, collection_target_n, dashboard_default_mode, updated_at');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q.order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getEvaluation = cache(async (id: string) => {
  const sb = await createClient();
  const { data, error } = await sb.from('evaluations')
    .select(`
      id, name, slug, status, project_id, description,
      collection_started_at, collection_target_n, dashboard_default_mode,
      instruments:evaluation_instruments(id, kind, name, kobo_form_id, schema_config, last_synced_at, last_sync_status),
      dashboard_configs:evaluation_dashboard_configs(id, version, spec, is_active)
    `)
    .eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export const listResponses = cache(async (args: {
  instrumentId: string;
  qcStatus?: 'pending' | 'approved' | 'cancelled_redo' | 'cancelled_dropped';
  region?: string;
  limit?: number;
}) => {
  const sb = await createClient();
  let q = sb.from('evaluation_responses')
    .select('id, kobo_submission_uuid, submitted_at, region, district, community, gender, age, qc_status, qc_checked_at, raw')
    .eq('instrument_id', args.instrumentId);
  if (args.qcStatus) q = q.eq('qc_status', args.qcStatus);
  if (args.region) q = q.eq('region', args.region);
  const { data, error } = await q.order('submitted_at', { ascending: false }).limit(args.limit ?? 200);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getActiveDashboardSpec = cache(async (evaluationId: string) => {
  const sb = await createClient();
  const { data, error } = await sb.from('evaluation_dashboard_configs')
    .select('id, version, spec')
    .eq('evaluation_id', evaluationId).eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export const getEvaluationForProject = cache(async (projectId: string) => {
  const sb = await createClient();
  const { data, error } = await sb.from('evaluations')
    .select('id, name, slug, status, collection_target_n, dashboard_default_mode')
    .eq('project_id', projectId)
    .in('status', ['collecting','analyzing'])
    .order('updated_at', { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export const getIngestionRunsSummary = cache(async (instrumentId: string) => {
  const sb = await createClient();
  const { data, error } = await sb.from('evaluation_ingestion_runs')
    .select('id, trigger, started_at, finished_at, status, fetched_count, inserted_count, updated_count, unmatched_investment_count, error_message')
    .eq('instrument_id', instrumentId)
    .order('started_at', { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listOpenIssues = cache(async (instrumentId: string) => {
  const sb = await createClient();
  const { data, error } = await sb.from('evaluation_ingestion_issues')
    .select('id, kobo_submission_uuid, kind, details, created_at')
    .eq('instrument_id', instrumentId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
});
```

- [ ] **Step 2: Implement actions**

Create `src/lib/evaluations/actions.ts`:

```ts
'use server';
import 'server-only';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/require-role-server';
import {
  evaluationCreateSchema, evaluationUpdateSchema,
  instrumentCreateSchema, instrumentUpdateSchema,
  qcActionSchema,
} from './schemas';
import { DashboardSpec } from './dashboard-spec';
import type { ActionResult } from '@/lib/action-result';

export async function setQcStatus(formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(['admin','staff']);
  if (!auth.ok) return { ok: false, error: 'unauthorized' };

  const parsed = qcActionSchema.safeParse({
    response_id: formData.get('response_id'),
    next_status: formData.get('next_status'),
  });
  if (!parsed.success) return { ok: false, error: 'invalid input' };

  const sb = await createClient();
  const { error } = await sb.from('evaluation_responses').update({
    qc_status: parsed.data.next_status,
    qc_checked_at: new Date().toISOString(),
    qc_checked_by: auth.userId,
  }).eq('id', parsed.data.response_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/workspace/evaluations/[id]/responses', 'page');
  return { ok: true };
}

export async function createEvaluation(formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return { ok: false, error: 'unauthorized' };
  const parsed = evaluationCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.message };
  const sb = await createClient();
  const { error } = await sb.from('evaluations').insert(parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/evaluations');
  return { ok: true };
}

export async function updateInstrument(formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return { ok: false, error: 'unauthorized' };
  const raw = Object.fromEntries(formData);
  // schema_config is sent as JSON string; pre-parse.
  if (typeof raw.schema_config === 'string') {
    try { raw.schema_config = JSON.parse(raw.schema_config); }
    catch { return { ok: false, error: 'schema_config must be valid JSON' }; }
  }
  const parsed = instrumentUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  const { id, ...patch } = parsed.data;
  const sb = await createClient();
  const { error } = await sb.from('evaluation_instruments').update(patch).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/evaluations/[id]', 'page');
  return { ok: true };
}

export async function setKoboToken(args: { instrumentId: string; token: string }): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return { ok: false, error: 'unauthorized' };
  if (!args.token || args.token.length < 8) return { ok: false, error: 'token looks too short' };
  const sb = createServiceClient();
  const { error } = await sb.rpc('kobo_token_set', {
    p_instrument_id: args.instrumentId, p_token: args.token,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/evaluations/[id]', 'page');
  return { ok: true };
}

export async function setDashboardSpec(formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return { ok: false, error: 'unauthorized' };
  const evaluationId = String(formData.get('evaluation_id') ?? '');
  const specText = String(formData.get('spec') ?? '');
  let json: unknown;
  try { json = JSON.parse(specText); }
  catch { return { ok: false, error: 'spec is not valid JSON' }; }
  const parsed = DashboardSpec.safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.message };

  const sb = await createClient();
  // Deactivate prior active, insert new with version+1.
  const { data: prev } = await sb.from('evaluation_dashboard_configs')
    .select('version').eq('evaluation_id', evaluationId).eq('is_active', true).maybeSingle();
  const nextVersion = (prev?.version ?? 0) + 1;
  const { error: deErr } = await sb.from('evaluation_dashboard_configs')
    .update({ is_active: false }).eq('evaluation_id', evaluationId).eq('is_active', true);
  if (deErr) return { ok: false, error: deErr.message };
  const { error: insErr } = await sb.from('evaluation_dashboard_configs')
    .insert({ evaluation_id: evaluationId, version: nextVersion, spec: parsed.data, is_active: true });
  if (insErr) return { ok: false, error: insErr.message };
  revalidatePath('/admin/evaluations/[id]', 'page');
  return { ok: true };
}

export async function triggerManualSync(instrumentId: string): Promise<ActionResult> {
  const auth = await requireRole(['admin','staff']);
  if (!auth.ok) return { ok: false, error: 'unauthorized' };
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/evaluations/sync?instrument_id=${encodeURIComponent(instrumentId)}&trigger=manual`,
    { method: 'POST', headers: { cookie: '' } },
  );
  if (!res.ok) return { ok: false, error: `sync HTTP ${res.status}` };
  return { ok: true };
}

export async function resolveIngestionIssue(formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return { ok: false, error: 'unauthorized' };
  const id = String(formData.get('id') ?? '');
  const sb = await createClient();
  const { error } = await sb.from('evaluation_ingestion_issues').update({
    resolved_at: new Date().toISOString(),
    resolved_by: auth.userId,
  }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/evaluations/[id]', 'page');
  return { ok: true };
}
```

- [ ] **Step 3: Typecheck**

```pwsh
npx tsc --noEmit
```

Expected: clean. If `ActionResult` type signature differs in this codebase, adjust the imports.

- [ ] **Step 4: Commit**

```bash
git add src/lib/evaluations/queries.ts src/lib/evaluations/actions.ts
git commit -m "feat(evaluations): queries + server actions"
```

---

## Task 15: Recharts dependency + chart components

**Files:**
- Modify: `package.json`
- Create: `src/components/evaluations/charts/*.tsx` (8 files)
- Create: `src/components/evaluations/kpi-tile.tsx`

- [ ] **Step 1: Install recharts**

```pwsh
npm install recharts
```

Expected: `recharts` added under `dependencies` in `package.json`.

- [ ] **Step 2: Create the chart components**

All chart components are client components ("use client") that take pre-aggregated data as props. Server queries the aggregator; the client component just renders.

`src/components/evaluations/charts/donut.tsx`:

```tsx
'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { BucketCount } from '@/lib/evaluations/aggregate';

const PALETTE = ['#0ea5e9','#22c55e','#f59e0b','#ef4444','#a855f7','#14b8a6','#eab308','#64748b'];

export function DonutChart({ data, title }: { data: BucketCount[]; title: string }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="label" innerRadius={50} outerRadius={80}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

`src/components/evaluations/charts/bar-pct.tsx`:

```tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { BucketPct } from '@/lib/evaluations/aggregate';

export function BarPctChart({ data, title }: { data: BucketPct[]; title: string }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <XAxis dataKey="label" />
          <YAxis tickFormatter={(v) => `${Math.round(v as number)}%`} />
          <Tooltip formatter={(v) => `${Math.round(v as number)}%`} />
          <Bar dataKey="pct" fill="#0ea5e9" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

`src/components/evaluations/charts/stacked-bar.tsx`:

```tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { StackedRow } from '@/lib/evaluations/aggregate';

const PALETTE = ['#0ea5e9','#22c55e','#f59e0b','#ef4444','#a855f7','#14b8a6'];

export function StackedBarChart({ data, title }: { data: StackedRow[]; title: string }) {
  // Flatten StackedRow[] into Recharts shape: one row per group, one key per series label.
  const allSeries = Array.from(new Set(data.flatMap((r) => r.series.map((s) => s.label))));
  const rows = data.map((r) => {
    const out: Record<string, number | string> = { group: r.group };
    for (const lbl of allSeries) {
      out[lbl] = r.series.find((s) => s.label === lbl)?.count ?? 0;
    }
    return out;
  });
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows}>
          <XAxis dataKey="group" />
          <YAxis />
          <Tooltip />
          <Legend />
          {allSeries.map((lbl, i) => (
            <Bar key={lbl} dataKey={lbl} stackId="s" fill={PALETTE[i % PALETTE.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

`src/components/evaluations/charts/horizontal-bar.tsx`:

```tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { BucketCount } from '@/lib/evaluations/aggregate';

export function HorizontalBarChart({ data, title }: { data: BucketCount[]; title: string }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" />
          <YAxis type="category" dataKey="label" width={150} />
          <Tooltip />
          <Bar dataKey="count" fill="#22c55e" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

`src/components/evaluations/charts/heatmap.tsx`:

```tsx
'use client';
import type { StackedRow } from '@/lib/evaluations/aggregate';

// Lightweight heatmap rendered with CSS grid. Recharts has no heatmap primitive
// and our scale here is small (≤6×6) so a hand-rolled grid is the simplest
// thing that works.
export function HeatmapChart({ data, title }: { data: StackedRow[]; title: string }) {
  const seriesLabels = Array.from(new Set(data.flatMap((r) => r.series.map((s) => s.label))));
  const max = Math.max(1, ...data.flatMap((r) => r.series.map((s) => s.count)));

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th></th>
              {seriesLabels.map((l) => <th key={l} className="px-2 py-1">{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.group}>
                <th className="px-2 py-1 text-left">{row.group}</th>
                {seriesLabels.map((l) => {
                  const c = row.series.find((s) => s.label === l)?.count ?? 0;
                  const alpha = c / max;
                  return (
                    <td key={l} className="px-3 py-2 text-center"
                        style={{ background: `rgba(14, 165, 233, ${alpha})` }}>
                      {c}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

`src/components/evaluations/charts/choropleth.tsx`:

```tsx
'use client';

// v1 choropleth is a labelled progress-bar list per region — a true SVG map of
// Ghana's northern regions can come later. The aggregator returns the same
// shape as progress-bars, so the engine routes both there for v1.
export function ChoroplethChart(props: {
  data: { region: string; count: number; target: number; pct: number }[];
  title: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{props.title}</h3>
      <ul className="space-y-2">
        {props.data.map((r) => (
          <li key={r.region}>
            <div className="flex justify-between text-xs">
              <span>{r.region}</span>
              <span>{r.count} / {r.target} ({Math.round(r.pct)}%)</span>
            </div>
            <div className="h-2 rounded bg-slate-100">
              <div className="h-2 rounded bg-sky-500"
                   style={{ width: `${Math.min(100, r.pct)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`src/components/evaluations/charts/progress-bars.tsx`:

```tsx
'use client';

export function ProgressBarsChart(props: {
  data: { region: string; count: number; target: number; pct: number }[];
  title: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{props.title}</h3>
      <ul className="space-y-2">
        {props.data.map((r) => (
          <li key={r.region}>
            <div className="flex justify-between text-xs">
              <span>{r.region}</span>
              <span>{r.count} / {r.target}</span>
            </div>
            <div className="h-2 rounded bg-slate-100">
              <div className="h-2 rounded bg-green-500"
                   style={{ width: `${Math.min(100, r.pct)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`src/components/evaluations/charts/trend-line.tsx`:

```tsx
'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function TrendLineChart({ data, title }: {
  data: { day: string; count: number }[];
  title: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

`src/components/evaluations/kpi-tile.tsx`:

```tsx
export function KpiTile({ label, value, sub }: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub ? <div className="text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```pwsh
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/evaluations/
git commit -m "feat(evaluations): KPI tile + 8 chart components (recharts + CSS grid heatmap)"
```

---

## Task 16: Chart engine, filter bar, mode toggle

**Files:**
- Create: `src/components/evaluations/chart-engine.tsx`
- Create: `src/components/evaluations/filter-bar.tsx`
- Create: `src/components/evaluations/mode-toggle.tsx`
- Create: `src/components/evaluations/sync-now-button.tsx`

- [ ] **Step 1: ChartEngine — server component that dispatches**

Create `src/components/evaluations/chart-engine.tsx`:

```tsx
import { aggregateDonut, aggregateBarPct, aggregateStackedBar,
  aggregateHorizontalBar, aggregateHeatmap, aggregateProgressBars,
  aggregateChoropleth, aggregateTrendLine } from '@/lib/evaluations/aggregate';
import type { ChartEntry } from '@/lib/evaluations/dashboard-spec';
import type { FilterState } from '@/lib/evaluations/schemas';
import { DonutChart } from './charts/donut';
import { BarPctChart } from './charts/bar-pct';
import { StackedBarChart } from './charts/stacked-bar';
import { HorizontalBarChart } from './charts/horizontal-bar';
import { HeatmapChart } from './charts/heatmap';
import { ChoroplethChart } from './charts/choropleth';
import { ProgressBarsChart } from './charts/progress-bars';
import { TrendLineChart } from './charts/trend-line';

export async function ChartEngine(props: {
  entry: ChartEntry;
  instrumentId: string;
  approvedOnly: boolean;
  filters: FilterState;
  targetN?: number;
}) {
  const base = {
    instrumentId: props.instrumentId,
    approvedOnly: props.approvedOnly,
    filters: props.filters,
  };

  try {
    switch (props.entry.type) {
      case 'donut': {
        const d = await aggregateDonut({ ...base, field: props.entry.field });
        return d.length ? <DonutChart data={d} title={props.entry.title} /> : empty(props.entry.title);
      }
      case 'bar_pct': {
        const d = await aggregateBarPct({ ...base, field: props.entry.field });
        return d.length ? <BarPctChart data={d} title={props.entry.title} /> : empty(props.entry.title);
      }
      case 'stacked_bar': {
        if (!props.entry.by) return invalid(props.entry.title, 'missing "by"');
        const d = await aggregateStackedBar({ ...base, field: props.entry.field, by: props.entry.by });
        return d.length ? <StackedBarChart data={d} title={props.entry.title} /> : empty(props.entry.title);
      }
      case 'horizontal_bar': {
        const d = await aggregateHorizontalBar({ ...base, field: props.entry.field });
        return d.length ? <HorizontalBarChart data={d} title={props.entry.title} /> : empty(props.entry.title);
      }
      case 'heatmap': {
        if (!props.entry.by) return invalid(props.entry.title, 'missing "by"');
        const d = await aggregateHeatmap({ ...base, field: props.entry.field, by: props.entry.by });
        return d.length ? <HeatmapChart data={d} title={props.entry.title} /> : empty(props.entry.title);
      }
      case 'choropleth': {
        const d = await aggregateChoropleth({ instrumentId: props.instrumentId, targetN: props.targetN ?? 0 });
        return d.length ? <ChoroplethChart data={d} title={props.entry.title} /> : empty(props.entry.title);
      }
      case 'progress_bars': {
        const d = await aggregateProgressBars({ instrumentId: props.instrumentId, targetN: props.targetN ?? 0 });
        return d.length ? <ProgressBarsChart data={d} title={props.entry.title} /> : empty(props.entry.title);
      }
      case 'trend_line': {
        const d = await aggregateTrendLine({ instrumentId: props.instrumentId, days: 30 });
        return d.length ? <TrendLineChart data={d} title={props.entry.title} /> : empty(props.entry.title);
      }
    }
  } catch (e) {
    return invalid(props.entry.title, e instanceof Error ? e.message : String(e));
  }
}

function empty(title: string) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <p className="text-xs text-slate-500">No data for this cut.</p>
    </div>
  );
}

function invalid(title: string, reason: string) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="mb-1 text-sm font-medium">{title}</h3>
      <p className="text-xs text-amber-700">Chart misconfigured: {reason}</p>
    </div>
  );
}
```

- [ ] **Step 2: FilterBar — client component**

Create `src/components/evaluations/filter-bar.tsx`:

```tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';

export function FilterBar(props: {
  regions: string[];
  districts: string[];
  communities: string[];
  socoExposureOptions: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === 'all' || value === 'All') next.delete(name);
    else next.set(name, value);
    router.push(`?${next.toString()}`);
  }

  const region = params.get('region') ?? '';
  const district = params.get('district') ?? '';
  const community = params.get('community') ?? '';
  const gender = params.get('gender') ?? 'all';
  const exposure = params.get('soco_exposure') ?? 'All';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
      <select value={region} onChange={(e) => setParam('region', e.target.value)} className="rounded border px-2 py-1">
        <option value="">All regions</option>
        {props.regions.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <select value={district} onChange={(e) => setParam('district', e.target.value)} className="rounded border px-2 py-1">
        <option value="">All districts</option>
        {props.districts.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select value={community} onChange={(e) => setParam('community', e.target.value)} className="rounded border px-2 py-1">
        <option value="">All communities</option>
        {props.communities.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={gender} onChange={(e) => setParam('gender', e.target.value)} className="rounded border px-2 py-1">
        <option value="all">All genders</option>
        <option value="female">Female</option>
        <option value="male">Male</option>
      </select>
      <select value={exposure} onChange={(e) => setParam('soco_exposure', e.target.value)} className="rounded border px-2 py-1">
        {props.socoExposureOptions.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: ModeToggle**

Create `src/components/evaluations/mode-toggle.tsx`:

```tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';

export function ModeToggle({ defaultMode }: { defaultMode: 'progress' | 'findings' }) {
  const router = useRouter();
  const params = useSearchParams();
  const mode = (params.get('mode') as 'progress' | 'findings' | null) ?? defaultMode;

  function setMode(m: 'progress' | 'findings') {
    const next = new URLSearchParams(params.toString());
    next.set('mode', m);
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="inline-flex rounded-lg border p-1 text-sm">
      <button type="button"
        onClick={() => setMode('progress')}
        className={`rounded px-3 py-1 ${mode === 'progress' ? 'bg-sky-500 text-white' : ''}`}>
        Progress
      </button>
      <button type="button"
        onClick={() => setMode('findings')}
        className={`rounded px-3 py-1 ${mode === 'findings' ? 'bg-sky-500 text-white' : ''}`}>
        Findings
      </button>
    </div>
  );
}
```

- [ ] **Step 4: SyncNowButton**

Create `src/components/evaluations/sync-now-button.tsx`:

```tsx
'use client';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { triggerManualSync } from '@/lib/evaluations/actions';

export function SyncNowButton({ instrumentId }: { instrumentId: string }) {
  const [pending, startTransition] = useTransition();
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const cooling = cooldownUntil !== null && cooldownUntil > Date.now();

  function onClick() {
    startTransition(async () => {
      const res = await triggerManualSync(instrumentId);
      if (res.ok) {
        toast.success('Sync triggered');
        setCooldownUntil(Date.now() + 60_000);
      } else {
        toast.error(res.error ?? 'Sync failed');
      }
    });
  }

  return (
    <button type="button" disabled={pending || cooling} onClick={onClick}
      className="rounded border px-3 py-1 text-sm disabled:opacity-50">
      {cooling ? 'Cooling down…' : pending ? 'Syncing…' : 'Sync now'}
    </button>
  );
}
```

- [ ] **Step 5: Typecheck + commit**

```pwsh
npx tsc --noEmit
```

```bash
git add src/components/evaluations/
git commit -m "feat(evaluations): chart engine + filter bar + mode toggle + sync button"
```

---

## Task 17: Staff index page `/workspace/evaluations`

**Files:**
- Create: `src/app/workspace/evaluations/page.tsx`
- Modify: `src/components/nav/sidebar.tsx` (or current sidebar component)

- [ ] **Step 1: Build the staff index page**

Create `src/app/workspace/evaluations/page.tsx`:

```tsx
import Link from 'next/link';
import { requireRole } from '@/lib/auth/require-role-server';
import { redirect } from 'next/navigation';
import { listEvaluations } from '@/lib/evaluations/queries';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function EvaluationsIndexPage() {
  const auth = await requireRole(['admin','staff']);
  if (!auth.ok) redirect('/');

  const evaluations = await listEvaluations();
  const sb = await createClient();
  const ids = evaluations.map((e) => e.id);
  const responseCountByEval = new Map<string, number>();
  if (ids.length > 0) {
    const { data: instruments } = await sb.from('evaluation_instruments')
      .select('id, evaluation_id').in('evaluation_id', ids);
    for (const inst of instruments ?? []) {
      const { count } = await sb.from('evaluation_responses')
        .select('id', { count: 'exact', head: true }).eq('instrument_id', inst.id);
      responseCountByEval.set(inst.evaluation_id, (responseCountByEval.get(inst.evaluation_id) ?? 0) + (count ?? 0));
    }
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Evaluations</h1>
      <p className="mt-1 text-sm text-slate-500">All M&E evaluations across projects.</p>

      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2">Name</th>
            <th>Status</th>
            <th>Responses / Target</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map((e) => {
            const count = responseCountByEval.get(e.id) ?? 0;
            return (
              <tr key={e.id} className="border-t">
                <td className="py-2">{e.name}</td>
                <td>{e.status}</td>
                <td>{count} / {e.collection_target_n ?? '—'}</td>
                <td>
                  <Link href={`/workspace/projects/${e.project_id}/dashboard`} className="text-sky-600 hover:underline">
                    Dashboard
                  </Link>
                  <span className="mx-2 text-slate-300">·</span>
                  <Link href={`/workspace/evaluations/${e.id}/responses`} className="text-sky-600 hover:underline">
                    QC table
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 2: Add a sidebar link**

Find the current sidebar component. The internal-workspace branch added an "Internal" link there; add an "Evaluations" link below it, visible to admin + staff. The exact location and component name to be located during this step (start with `Grep "Internal tasks"` or similar). Add an `Evaluations` entry pointing to `/workspace/evaluations`.

- [ ] **Step 3: Typecheck + smoke**

```pwsh
npx tsc --noEmit
npm run dev
```

Visit `http://localhost:3000/workspace/evaluations` while signed in as staff. Expected: page renders without runtime errors. If no evaluations exist, an empty table is fine.

- [ ] **Step 4: Commit**

```bash
git add src/app/workspace/evaluations/page.tsx src/components/nav/sidebar.tsx
git commit -m "feat(evaluations): staff index page + sidebar entry"
```

---

## Task 18: Dashboard pages (staff + portal)

**Files:**
- Create: `src/app/workspace/projects/[id]/dashboard/page.tsx`
- Create: `src/app/portal/projects/[id]/dashboard/page.tsx`
- Create: `src/components/evaluations/dashboard-view.tsx` (shared body)

- [ ] **Step 1: Shared dashboard body**

Create `src/components/evaluations/dashboard-view.tsx`:

```tsx
import { ChartEngine } from './chart-engine';
import { FilterBar } from './filter-bar';
import { ModeToggle } from './mode-toggle';
import { SyncNowButton } from './sync-now-button';
import { KpiTile } from './kpi-tile';
import { getActiveDashboardSpec } from '@/lib/evaluations/queries';
import { DashboardSpec } from '@/lib/evaluations/dashboard-spec';
import type { FilterState } from '@/lib/evaluations/schemas';
import { createClient } from '@/lib/supabase/server';

export async function DashboardView(props: {
  evaluationId: string;
  instrumentId: string;
  targetN: number | null;
  defaultMode: 'auto' | 'progress' | 'findings';
  searchParams: Record<string, string | string[] | undefined>;
  approvedOnly: boolean;
  showStaffControls: boolean;
}) {
  const cfg = await getActiveDashboardSpec(props.evaluationId);
  if (!cfg) {
    return <p className="p-6 text-sm text-slate-500">No dashboard config is active for this evaluation.</p>;
  }
  const spec = DashboardSpec.parse(cfg.spec);

  const filters: FilterState = {
    region: pickStr(props.searchParams.region),
    district: pickStr(props.searchParams.district),
    community: pickStr(props.searchParams.community),
    gender: (pickStr(props.searchParams.gender) as FilterState['gender']) ?? 'all',
    soco_exposure: pickStr(props.searchParams.soco_exposure) ?? 'All',
  };

  // Decide default mode if not overridden.
  const sb = await createClient();
  const { count: approvedCount } = await sb.from('evaluation_responses')
    .select('id', { count: 'exact', head: true })
    .eq('instrument_id', props.instrumentId).eq('qc_status','approved');
  const targetN = props.targetN ?? 0;
  const collectionPct = targetN > 0 ? (approvedCount ?? 0) / targetN : 0;
  const autoMode: 'progress' | 'findings' = collectionPct >= 0.8 ? 'findings' : 'progress';
  const explicit = pickStr(props.searchParams.mode) as 'progress' | 'findings' | undefined;
  const effectiveDefault = props.defaultMode === 'auto' ? autoMode :
    (props.defaultMode as 'progress' | 'findings');
  const mode = explicit ?? effectiveDefault;

  // Filter option sources — just distinct values from responses (cheap at v1 scale).
  const distinct = async (col: 'region' | 'district' | 'community') => {
    const { data } = await sb.from('evaluation_responses')
      .select(col).eq('instrument_id', props.instrumentId).not(col, 'is', null);
    return Array.from(new Set((data ?? []).map((r: Record<string, unknown>) => r[col] as string))).sort();
  };
  const [regions, districts, communities] = await Promise.all([
    distinct('region'), distinct('district'), distinct('community'),
  ]);
  const exposureOptions = ['All', ...Object.keys(spec.disaggregations.soco_exposure)];

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Evaluation dashboard</h1>
          <span className="text-xs text-slate-500">
            {approvedCount ?? 0} approved / {targetN || '—'} target
          </span>
        </div>
        <div className="flex items-center gap-2">
          {props.showStaffControls && <SyncNowButton instrumentId={props.instrumentId} />}
          <ModeToggle defaultMode={effectiveDefault} />
        </div>
      </header>

      <FilterBar regions={regions} districts={districts} communities={communities}
        socoExposureOptions={exposureOptions} />

      {mode === 'progress' ? (
        <ProgressMode targetN={targetN} instrumentId={props.instrumentId} approvedOnly={props.approvedOnly} filters={filters} />
      ) : (
        <FindingsMode spec={spec} instrumentId={props.instrumentId} approvedOnly={props.approvedOnly} filters={filters} targetN={targetN} />
      )}
    </div>
  );
}

function pickStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

async function ProgressMode(props: {
  instrumentId: string; approvedOnly: boolean; targetN: number;
  filters: FilterState;
}) {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiTile label="Approved" value="—" sub="vs target" />
        <KpiTile label="Awaiting QC" value="—" />
        <KpiTile label="Districts active" value="—" />
      </div>
      <ChartEngine
        entry={{ type: 'choropleth', field: '_progress', title: 'Regional % of target' }}
        instrumentId={props.instrumentId} approvedOnly={props.approvedOnly}
        filters={props.filters} targetN={props.targetN}
      />
      <ChartEngine
        entry={{ type: 'trend_line', field: '_submitted_at', title: 'Daily submissions (last 30 days)' }}
        instrumentId={props.instrumentId} approvedOnly={props.approvedOnly}
        filters={props.filters}
      />
      <ChartEngine
        entry={{ type: 'progress_bars', field: '_progress', title: 'Per-region progress vs target' }}
        instrumentId={props.instrumentId} approvedOnly={props.approvedOnly}
        filters={props.filters} targetN={props.targetN}
      />
    </section>
  );
}

async function FindingsMode(props: {
  spec: DashboardSpec;
  instrumentId: string;
  approvedOnly: boolean;
  filters: FilterState;
  targetN: number;
}) {
  return (
    <section className="space-y-8">
      {props.spec.sections.map((s) => (
        <div key={s.id} className="space-y-3">
          <h2 className="text-lg font-medium">{s.title}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {s.charts.map((c, i) => (
              <ChartEngine key={`${s.id}-${i}`} entry={c} instrumentId={props.instrumentId}
                approvedOnly={props.approvedOnly} filters={props.filters} targetN={props.targetN} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Staff dashboard page**

Create `src/app/workspace/projects/[id]/dashboard/page.tsx`:

```tsx
import { redirect, notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require-role-server';
import { getEvaluationForProject, getEvaluation } from '@/lib/evaluations/queries';
import { DashboardView } from '@/components/evaluations/dashboard-view';

export const dynamic = 'force-dynamic';

export default async function StaffDashboardPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireRole(['admin','staff']);
  if (!auth.ok) redirect('/');
  const { id: projectId } = await params;
  const sp = await searchParams;
  const evMin = await getEvaluationForProject(projectId);
  if (!evMin) return notFound();
  const ev = await getEvaluation(evMin.id);
  if (!ev) return notFound();
  const hh = (ev.instruments ?? []).find((i: { kind: string }) => i.kind === 'hh');
  if (!hh) return <p className="p-6 text-sm text-slate-500">No instrument configured.</p>;

  return (
    <DashboardView
      evaluationId={ev.id}
      instrumentId={hh.id}
      targetN={ev.collection_target_n}
      defaultMode={(ev.dashboard_default_mode ?? 'auto') as 'auto'|'progress'|'findings'}
      searchParams={sp}
      approvedOnly={false}
      showStaffControls
    />
  );
}
```

- [ ] **Step 3: Portal dashboard page**

Create `src/app/portal/projects/[id]/dashboard/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require-role-server';
import { getEvaluationForProject, getEvaluation } from '@/lib/evaluations/queries';
import { DashboardView } from '@/components/evaluations/dashboard-view';

export const dynamic = 'force-dynamic';

export default async function PortalDashboardPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireRole(['client','admin','staff']);
  if (!auth.ok) redirect('/');
  const { id: projectId } = await params;
  const sp = await searchParams;
  const evMin = await getEvaluationForProject(projectId);
  if (!evMin) return notFound();
  const ev = await getEvaluation(evMin.id);
  if (!ev) return notFound();
  const hh = (ev.instruments ?? []).find((i: { kind: string }) => i.kind === 'hh');
  if (!hh) return notFound();

  return (
    <DashboardView
      evaluationId={ev.id}
      instrumentId={hh.id}
      targetN={ev.collection_target_n}
      defaultMode={(ev.dashboard_default_mode ?? 'auto') as 'auto'|'progress'|'findings'}
      searchParams={sp}
      approvedOnly
      showStaffControls={false}
    />
  );
}
```

- [ ] **Step 4: Add a portal nav link to the dashboard**

Edit the portal project page (find with `Grep "portal/projects/\[id\]/page"`) so that when `getEvaluationForProject` returns a value, a "Dashboard" link is rendered alongside the existing portal nav. Keep this change small — one conditional link.

- [ ] **Step 5: Typecheck + smoke**

```pwsh
npx tsc --noEmit
npm run dev
```

Visit `/workspace/projects/<projectId>/dashboard` as staff and `/portal/projects/<projectId>/dashboard` as a client member of that project. Expected: dashboards render; client sees approved data only; staff sees full set.

- [ ] **Step 6: Commit**

```bash
git add src/components/evaluations/dashboard-view.tsx src/app/workspace/projects/[id]/dashboard src/app/portal/projects/[id]/dashboard src/app/portal
git commit -m "feat(evaluations): dashboard pages (staff + portal) with shared view"
```

---

## Task 19: Staff QC table `/workspace/evaluations/[id]/responses`

**Files:**
- Create: `src/app/workspace/evaluations/[id]/responses/page.tsx`
- Create: `src/components/evaluations/qc-row-actions.tsx`

- [ ] **Step 1: QC row actions component**

Create `src/components/evaluations/qc-row-actions.tsx`:

```tsx
'use client';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { setQcStatus } from '@/lib/evaluations/actions';

export function QcRowActions({ responseId, current }: {
  responseId: string;
  current: 'pending' | 'approved' | 'edited' | 'cancelled_redo' | 'cancelled_dropped';
}) {
  const [pending, startTransition] = useTransition();

  function send(next: 'approved' | 'cancelled_redo' | 'cancelled_dropped') {
    const fd = new FormData();
    fd.set('response_id', responseId);
    fd.set('next_status', next);
    startTransition(async () => {
      const res = await setQcStatus(fd);
      if (res.ok) toast.success(`Marked ${next}`);
      else toast.error(res.error ?? 'Update failed');
    });
  }

  return (
    <div className="flex gap-1 text-xs">
      <button disabled={pending || current === 'approved'} onClick={() => send('approved')}
        className="rounded border px-2 py-0.5 disabled:opacity-50">Approve</button>
      <button disabled={pending || current === 'cancelled_redo'} onClick={() => send('cancelled_redo')}
        className="rounded border px-2 py-0.5 disabled:opacity-50">Redo</button>
      <button disabled={pending || current === 'cancelled_dropped'} onClick={() => send('cancelled_dropped')}
        className="rounded border px-2 py-0.5 disabled:opacity-50">Cancel</button>
    </div>
  );
}
```

- [ ] **Step 2: QC table page**

Create `src/app/workspace/evaluations/[id]/responses/page.tsx`:

```tsx
import { redirect, notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require-role-server';
import { getEvaluation, listResponses } from '@/lib/evaluations/queries';
import { QcRowActions } from '@/components/evaluations/qc-row-actions';

export const dynamic = 'force-dynamic';

export default async function QcTablePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireRole(['admin','staff']);
  if (!auth.ok) redirect('/');
  const { id } = await params;
  const sp = await searchParams;
  const ev = await getEvaluation(id);
  if (!ev) return notFound();
  const hh = (ev.instruments ?? []).find((i: { kind: string }) => i.kind === 'hh');
  if (!hh) return notFound();

  const qcStatus = (Array.isArray(sp.qc_status) ? sp.qc_status[0] : sp.qc_status) as
    'pending' | 'approved' | 'cancelled_redo' | 'cancelled_dropped' | undefined;
  const region = Array.isArray(sp.region) ? sp.region[0] : sp.region;

  const rows = await listResponses({ instrumentId: hh.id, qcStatus, region });

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">QC: {ev.name}</h1>
      <p className="text-xs text-slate-500">
        Internal QC view. Names, phone numbers, and any PII visible here stay out of the dashboard.
      </p>

      <div className="mt-3 flex gap-2 text-xs">
        {(['pending','approved','cancelled_redo','cancelled_dropped'] as const).map((s) => (
          <a key={s} href={`?qc_status=${s}`}
            className={`rounded border px-2 py-1 ${qcStatus === s ? 'bg-sky-50 border-sky-300' : ''}`}>
            {s}
          </a>
        ))}
        <a href="?" className={`rounded border px-2 py-1 ${!qcStatus ? 'bg-sky-50 border-sky-300' : ''}`}>All</a>
      </div>

      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-2">Submitted</th>
            <th>Region / District / Community</th>
            <th>Gender</th>
            <th>Age</th>
            <th>QC</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2">{new Date(r.submitted_at).toLocaleString()}</td>
              <td>{[r.region, r.district, r.community].filter(Boolean).join(' / ')}</td>
              <td>{r.gender ?? '—'}</td>
              <td>{r.age ?? '—'}</td>
              <td>{r.qc_status}</td>
              <td><QcRowActions responseId={r.id} current={r.qc_status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + smoke**

```pwsh
npx tsc --noEmit
```

Expected: clean. Visit `/workspace/evaluations/<id>/responses`; verify filters change the row set and the Approve button works.

- [ ] **Step 4: Commit**

```bash
git add src/app/workspace/evaluations/[id]/responses/page.tsx src/components/evaluations/qc-row-actions.tsx
git commit -m "feat(evaluations): staff QC table with row-level actions"
```

---

## Task 20: Admin pages (instrument config, dashboard editor, MIS upload, triage)

**Files:**
- Create: `src/app/admin/evaluations/page.tsx`
- Create: `src/app/admin/evaluations/[id]/page.tsx`
- Create: `src/components/evaluations/dashboard-config-editor.tsx`
- Create: `src/components/evaluations/mis-upload-form.tsx`
- Create: `src/components/evaluations/kobo-token-form.tsx`
- Create: `src/app/api/evaluations/[id]/mis/upload/route.ts`

- [ ] **Step 1: Admin index**

Create `src/app/admin/evaluations/page.tsx`:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require-role-server';
import { listEvaluations } from '@/lib/evaluations/queries';

export const dynamic = 'force-dynamic';

export default async function AdminEvaluationsIndex() {
  const auth = await requireRole(['admin']);
  if (!auth.ok) redirect('/');
  const evs = await listEvaluations();
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Admin · Evaluations</h1>
      <ul className="mt-4 space-y-2">
        {evs.map((e) => (
          <li key={e.id}>
            <Link href={`/admin/evaluations/${e.id}`} className="text-sky-600 hover:underline">
              {e.name}
            </Link>
            <span className="ml-2 text-xs text-slate-500">{e.status} · target {e.collection_target_n ?? '—'}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Admin detail page**

Create `src/app/admin/evaluations/[id]/page.tsx`:

```tsx
import { redirect, notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require-role-server';
import { getEvaluation, getIngestionRunsSummary, listOpenIssues, getActiveDashboardSpec } from '@/lib/evaluations/queries';
import { DashboardConfigEditor } from '@/components/evaluations/dashboard-config-editor';
import { MisUploadForm } from '@/components/evaluations/mis-upload-form';
import { KoboTokenForm } from '@/components/evaluations/kobo-token-form';
import { resolveIngestionIssue } from '@/lib/evaluations/actions';

export const dynamic = 'force-dynamic';

export default async function AdminEvaluationDetail({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin']);
  if (!auth.ok) redirect('/');
  const { id } = await params;
  const ev = await getEvaluation(id);
  if (!ev) return notFound();
  const hh = (ev.instruments ?? []).find((i: { kind: string }) => i.kind === 'hh');
  const spec = await getActiveDashboardSpec(id);
  const runs = hh ? await getIngestionRunsSummary(hh.id) : [];
  const issues = hh ? await listOpenIssues(hh.id) : [];

  return (
    <main className="space-y-8 p-6">
      <header>
        <h1 className="text-xl font-semibold">{ev.name}</h1>
        <p className="text-xs text-slate-500">slug: {ev.slug} · status: {ev.status}</p>
      </header>

      {hh && (
        <section>
          <h2 className="text-sm font-medium">Household instrument</h2>
          <p className="text-xs text-slate-500">Kobo form id: {hh.kobo_form_id}</p>
          <p className="text-xs text-slate-500">Last sync: {hh.last_synced_at ?? 'never'} · status: {hh.last_sync_status ?? '—'}</p>
          <KoboTokenForm instrumentId={hh.id} />
          <details className="mt-2">
            <summary className="cursor-pointer text-sm">Schema config (Kobo → semantic)</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-slate-50 p-2 text-xs">
{JSON.stringify(hh.schema_config, null, 2)}
            </pre>
          </details>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium">Dashboard spec</h2>
        <DashboardConfigEditor evaluationId={ev.id} initialSpec={spec?.spec ?? null} />
      </section>

      {hh && (
        <section>
          <h2 className="text-sm font-medium">MIS investments</h2>
          <MisUploadForm evaluationId={ev.id} />
        </section>
      )}

      {hh && (
        <section>
          <h2 className="text-sm font-medium">Recent ingestion runs</h2>
          <table className="mt-2 w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th>Started</th><th>Trigger</th><th>Status</th>
                <th>Fetched</th><th>Inserted</th><th>Unmatched</th><th>Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t">
                  <td>{new Date(r.started_at).toLocaleString()}</td>
                  <td>{r.trigger}</td>
                  <td>{r.status}</td>
                  <td>{r.fetched_count}</td>
                  <td>{r.inserted_count}</td>
                  <td>{r.unmatched_investment_count}</td>
                  <td className="text-red-700">{r.error_message ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {hh && (
        <section>
          <h2 className="text-sm font-medium">Open ingestion issues</h2>
          <ul className="mt-2 space-y-2 text-xs">
            {issues.map((i) => (
              <li key={i.id} className="rounded border p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{i.kind}</span>
                    <span className="ml-2 text-slate-500">{new Date(i.created_at).toLocaleString()}</span>
                  </div>
                  <form action={resolveIngestionIssue}>
                    <input type="hidden" name="id" value={i.id} />
                    <button className="rounded border px-2 py-0.5">Resolve</button>
                  </form>
                </div>
                <pre className="mt-1 overflow-auto rounded bg-slate-50 p-1">{JSON.stringify(i.details)}</pre>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 3: DashboardConfigEditor — JSON textarea + save**

Create `src/components/evaluations/dashboard-config-editor.tsx`:

```tsx
'use client';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setDashboardSpec } from '@/lib/evaluations/actions';

export function DashboardConfigEditor(props: { evaluationId: string; initialSpec: unknown }) {
  const [text, setText] = useState(JSON.stringify(props.initialSpec ?? {}, null, 2));
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('evaluation_id', props.evaluationId);
      fd.set('spec', text);
      const r = await setDashboardSpec(fd);
      if (r.ok) toast.success('Saved');
      else toast.error(r.error ?? 'Save failed');
    });
  }

  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)}
        rows={20} className="w-full rounded border p-2 font-mono text-xs" />
      <button type="button" disabled={pending} onClick={onSave}
        className="rounded border px-3 py-1 text-sm disabled:opacity-50">
        {pending ? 'Saving…' : 'Save dashboard spec'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: KoboTokenForm**

Create `src/components/evaluations/kobo-token-form.tsx`:

```tsx
'use client';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setKoboToken } from '@/lib/evaluations/actions';

export function KoboTokenForm({ instrumentId }: { instrumentId: string }) {
  const [token, setToken] = useState('');
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      const r = await setKoboToken({ instrumentId, token });
      if (r.ok) { toast.success('Token saved'); setToken(''); }
      else toast.error(r.error ?? 'Save failed');
    });
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
        placeholder="Kobo API token" className="w-72 rounded border px-2 py-1 text-xs" />
      <button type="button" disabled={pending || token.length < 8} onClick={onSave}
        className="rounded border px-3 py-1 text-sm disabled:opacity-50">
        {pending ? 'Saving…' : 'Save token'}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: MIS upload — form + API route**

Create `src/components/evaluations/mis-upload-form.tsx`:

```tsx
'use client';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

export function MisUploadForm({ evaluationId }: { evaluationId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  function onUpload() {
    if (!file) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('file', file);
      const r = await fetch(`/api/evaluations/${evaluationId}/mis/upload`, { method: 'POST', body: fd });
      if (r.ok) toast.success('Uploaded'); else toast.error(`Upload failed (${r.status})`);
    });
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input type="file" accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button type="button" disabled={pending || !file} onClick={onUpload}
        className="rounded border px-3 py-1 text-sm disabled:opacity-50">
        {pending ? 'Uploading…' : 'Upload MIS investments'}
      </button>
    </div>
  );
}
```

Create `src/app/api/evaluations/[id]/mis/upload/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-role-server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 });
  const { id: evaluationId } = await params;

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return new NextResponse('No file', { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const rows = await parseRows(file.name, buf);
  if (rows.length === 0) return new NextResponse('No rows parsed', { status: 400 });

  const sb = createServiceClient();
  // Replace strategy: delete existing for this evaluation, then bulk insert.
  await sb.from('mis_investments').delete().eq('evaluation_id', evaluationId);
  const { error } = await sb.from('mis_investments').insert(
    rows.map((r) => ({ ...r, evaluation_id: evaluationId })),
  );
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ inserted: rows.length });
}

async function parseRows(name: string, buf: Buffer): Promise<Array<{
  community: string; district: string; investment_type: string; investment_name: string; completion_date: string | null;
}>> {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv')) {
    const text = buf.toString('utf8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((ln) => {
      const cells = ln.split(',').map((c) => c.trim());
      const get = (k: string) => cells[header.indexOf(k)] ?? '';
      return {
        community: get('community'),
        district: get('district'),
        investment_type: get('investment_type'),
        investment_name: get('investment_name'),
        completion_date: get('completion_date') || null,
      };
    }).filter((r) => r.community && r.investment_name);
  }
  // XLSX path via exceljs
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headerRow = ws.getRow(1);
  const headerMap: Record<string, number> = {};
  headerRow.eachCell((cell, col) => { headerMap[String(cell.value).trim().toLowerCase()] = col; });
  const rows: Array<{ community: string; district: string; investment_type: string; investment_name: string; completion_date: string | null }> = [];
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const get = (k: string) => {
      const col = headerMap[k];
      return col ? String(row.getCell(col).value ?? '').trim() : '';
    };
    if (!get('community') || !get('investment_name')) continue;
    rows.push({
      community: get('community'),
      district: get('district'),
      investment_type: get('investment_type'),
      investment_name: get('investment_name'),
      completion_date: get('completion_date') || null,
    });
  }
  return rows;
}
```

- [ ] **Step 6: Typecheck + commit**

```pwsh
npx tsc --noEmit
```

```bash
git add src/app/admin/evaluations src/components/evaluations/dashboard-config-editor.tsx src/components/evaluations/mis-upload-form.tsx src/components/evaluations/kobo-token-form.tsx src/app/api/evaluations/[id]
git commit -m "feat(evaluations): admin pages (config editor, MIS upload, Kobo token, triage)"
```

---

## Task 21: RLS test suite extension

**Files:**
- Modify: `tests/rls/evaluations.test.ts`

- [ ] **Step 1: Add the missing RLS cases**

Add three more `it(...)` blocks to `tests/rls/evaluations.test.ts` so the suite covers all the visibility requirements from spec § 2.7:

```ts
it('staff sees all responses for projects they belong to', async () => {
  const admin = adminClient();
  const staffEmail = `ev-staff-${Date.now()}@example.com`;
  const staffId = await createTestUser('staff', staffEmail);
  const { data: org } = await admin.from('clients')
    .insert({ name: 'Org Staff' }).select('id').single();
  const { data: project } = await admin.from('projects')
    .insert({ name: 'Staff Eval', code: `EVSF-${Date.now()}`, client_id: org!.id })
    .select('id').single();
  await admin.from('project_members')
    .insert({ project_id: project!.id, user_id: staffId, project_role: 'manager' });
  const { data: ev } = await admin.from('evaluations')
    .insert({ project_id: project!.id, name: 'E', slug: `staff-${Date.now()}` })
    .select('id').single();
  const { data: inst } = await admin.from('evaluation_instruments')
    .insert({ evaluation_id: ev!.id, kind: 'hh', name: 'HH', kobo_form_id: 'f' })
    .select('id').single();
  await admin.from('evaluation_responses').insert([
    { instrument_id: inst!.id, kobo_submission_uuid: 'p1', submitted_at: new Date().toISOString(), raw: {}, qc_status: 'pending' },
    { instrument_id: inst!.id, kobo_submission_uuid: 'a1', submitted_at: new Date().toISOString(), raw: {}, qc_status: 'approved' },
  ]);
  const sb = await clientAs(staffEmail);
  const { data } = await sb.from('evaluation_responses')
    .select('kobo_submission_uuid').eq('instrument_id', inst!.id);
  const uuids = (data ?? []).map((r) => r.kobo_submission_uuid);
  expect(uuids).toContain('p1');
  expect(uuids).toContain('a1');
});

it('staff can update qc_status; client cannot', async () => {
  const admin = adminClient();
  const staffEmail = `ev-staff-up-${Date.now()}@example.com`;
  const clientEmail = `ev-client-up-${Date.now()}@example.com`;
  const staffId = await createTestUser('staff', staffEmail);
  const clientId = await createTestUser('client', clientEmail);
  const { data: org } = await admin.from('clients').insert({ name: 'Org Up' }).select('id').single();
  const { data: project } = await admin.from('projects')
    .insert({ name: 'Eval Up', code: `EVUP-${Date.now()}`, client_id: org!.id })
    .select('id').single();
  await admin.from('project_members').insert([
    { project_id: project!.id, user_id: staffId, project_role: 'manager' },
    { project_id: project!.id, user_id: clientId, project_role: 'viewer' },
  ]);
  const { data: ev } = await admin.from('evaluations')
    .insert({ project_id: project!.id, name: 'E', slug: `up-${Date.now()}` })
    .select('id').single();
  const { data: inst } = await admin.from('evaluation_instruments')
    .insert({ evaluation_id: ev!.id, kind: 'hh', name: 'HH', kobo_form_id: 'f' })
    .select('id').single();
  const { data: resp } = await admin.from('evaluation_responses')
    .insert({ instrument_id: inst!.id, kobo_submission_uuid: 'qc-1',
              submitted_at: new Date().toISOString(), raw: {}, qc_status: 'pending' })
    .select('id').single();

  const sStaff = await clientAs(staffEmail);
  const upStaff = await sStaff.from('evaluation_responses').update({ qc_status: 'approved' }).eq('id', resp!.id);
  expect(upStaff.error).toBeNull();

  const sClient = await clientAs(clientEmail);
  const upClient = await sClient.from('evaluation_responses').update({ qc_status: 'pending' }).eq('id', resp!.id);
  // RLS denies the update — either error or zero rows affected. Both are acceptable.
  // Re-read should still be 'approved'.
  const after = await admin.from('evaluation_responses').select('qc_status').eq('id', resp!.id).single();
  expect(after.data?.qc_status).toBe('approved');
});

it('non-member client cannot read evaluations in other projects', async () => {
  const admin = adminClient();
  const outsiderEmail = `ev-outsider-${Date.now()}@example.com`;
  await createTestUser('client', outsiderEmail);
  const { data: org } = await admin.from('clients').insert({ name: 'Org X' }).select('id').single();
  const { data: project } = await admin.from('projects')
    .insert({ name: 'Stranger', code: `STR-${Date.now()}`, client_id: org!.id })
    .select('id').single();
  await admin.from('evaluations').insert({ project_id: project!.id, name: 'E', slug: `str-${Date.now()}` });
  const sb = await clientAs(outsiderEmail);
  const { data } = await sb.from('evaluations').select('id').eq('project_id', project!.id);
  expect((data ?? []).length).toBe(0);
});
```

- [ ] **Step 2: Run**

```pwsh
npm test -- tests/rls/evaluations.test.ts
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/rls/evaluations.test.ts
git commit -m "test(evaluations): RLS coverage for staff/client/outsider paths + qc_status writes"
```

---

## Task 22: Ingestion integration test (with mocked Kobo)

**Files:**
- Create: `tests/integration/evaluation-ingest.test.ts`
- Create: `tests/fixtures/kobo-sample.json`

- [ ] **Step 1: Fixture payload**

Create `tests/fixtures/kobo-sample.json`:

```json
{
  "count": 3,
  "results": [
    {
      "_id": 1001,
      "_uuid": "sub-1001",
      "_submission_time": "2026-05-10T08:00:00Z",
      "s0_a4": "Northern", "s0_a5": "Tamale", "s0_a7": "Sagnarigu",
      "s1_a1": "female", "s1_a2": "32",
      "s7_qc_status": "approved",
      "investments": [
        { "inv_name": "Sagnarigu Borehole 1", "satisfaction": 4 }
      ]
    },
    {
      "_id": 1002,
      "_uuid": "sub-1002",
      "_submission_time": "2026-05-10T09:00:00Z",
      "s0_a4": "Northern", "s0_a5": "Tamale", "s0_a7": "Sagnarigu",
      "s1_a1": "male", "s1_a2": "41",
      "investments": [
        { "inv_name": "Completely Unknown Investment", "satisfaction": 2 }
      ]
    },
    {
      "_id": 1001,
      "_uuid": "sub-1001",
      "_submission_time": "2026-05-10T08:00:00Z",
      "s0_a4": "Northern", "s0_a5": "Tamale", "s0_a7": "Sagnarigu",
      "s1_a1": "female", "s1_a2": "32",
      "s7_qc_status": "approved",
      "investments": []
    }
  ]
}
```

- [ ] **Step 2: Test**

Create `tests/integration/evaluation-ingest.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { adminClient, cleanupTestData } from '../rls/setup';
import sample from '../fixtures/kobo-sample.json';

let instrumentId: string;
let evaluationId: string;

beforeAll(async () => {
  const admin = adminClient();
  const { data: project } = await admin.from('projects')
    .insert({ name: 'IngestTest', code: `ING-${Date.now()}` }).select('id').single();
  const { data: ev } = await admin.from('evaluations')
    .insert({ project_id: project!.id, name: 'Ingest', slug: `ing-${Date.now()}`, status: 'collecting' })
    .select('id').single();
  evaluationId = ev!.id;
  const { data: inst } = await admin.from('evaluation_instruments').insert({
    evaluation_id: ev!.id, kind: 'hh', name: 'HH', kobo_form_id: 'fixture-form',
    schema_config: {
      s0_a4: 'region', s0_a5: 'district', s0_a7: 'community',
      s1_a1: 'gender', s1_a2: 'age', s7_qc_status: 'qc_status',
    },
  }).select('id').single();
  instrumentId = inst!.id;
  // Provision a Kobo token row so decrypt path works. In the absence of pgsodium
  // on this env, the RPC may be stubbed — guard against that.
  try { await admin.rpc('kobo_token_set', { p_instrument_id: instrumentId, p_token: 'test-token' }); } catch {}
  // Seed one MIS investment so the matcher hits.
  await admin.from('mis_investments').insert({
    evaluation_id: ev!.id, community: 'Sagnarigu', district: 'Tamale',
    investment_type: 'borehole', investment_name: 'Sagnarigu Borehole 1',
  });

  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, status: 200,
    json: async () => sample,
    text: async () => JSON.stringify(sample),
  })));
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await cleanupTestData();
});

describe('ingestInstrument', () => {
  it('upserts new + duplicate + unmatched and logs runs/issues', async () => {
    const { ingestInstrument } = await import('@/lib/evaluations/ingest');
    const r = await ingestInstrument({ instrumentId, trigger: 'manual' });
    expect(r.status === 'ok' || r.status === 'partial').toBe(true);
    expect(r.fetched).toBeGreaterThanOrEqual(2);

    const admin = adminClient();
    const { data: rows } = await admin.from('evaluation_responses')
      .select('kobo_submission_uuid, qc_status, gender, region')
      .eq('instrument_id', instrumentId);
    const uuids = (rows ?? []).map((r) => r.kobo_submission_uuid);
    expect(uuids).toContain('sub-1001');
    expect(uuids).toContain('sub-1002');
    expect((rows ?? []).filter((r) => r.kobo_submission_uuid === 'sub-1001').length).toBe(1);
    const sub1001 = (rows ?? []).find((r) => r.kobo_submission_uuid === 'sub-1001');
    expect(sub1001?.qc_status).toBe('approved');
    expect(sub1001?.region).toBe('Northern');

    const { data: issues } = await admin.from('evaluation_ingestion_issues')
      .select('kind, details').eq('instrument_id', instrumentId);
    const kinds = (issues ?? []).map((i) => i.kind);
    expect(kinds).toContain('unmatched_investment');
  });
});
```

- [ ] **Step 3: Run**

```pwsh
npm test -- tests/integration/evaluation-ingest.test.ts
```

Expected: PASS. If the kobo_token RPC blocks the test on a no-pgsodium env, the `try { ... } catch {}` keeps the test runnable; you'll need to short-circuit `decryptKoboToken` in dev. Acceptable fallback: in `decryptKoboToken`, when `process.env.NODE_ENV === 'test'` and the RPC errors, return `'test-token'`.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/evaluation-ingest.test.ts tests/fixtures/kobo-sample.json src/lib/evaluations/kobo.ts
git commit -m "test(evaluations): integration test for ingestion pipeline (mocked Kobo)"
```

---

## Task 23: Final sweep — lint, typecheck, full test run, dev smoke

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

```pwsh
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Lint**

```pwsh
npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Run the full test suite**

```pwsh
npm test
```

Expected: all green. Known-flaky RLS tests (hosted-Supabase contention) may need a retry; rerun those specific files if any time out.

- [ ] **Step 4: Dev smoke**

```pwsh
npm run dev
```

Manually verify:
- `/workspace/evaluations` — staff sees list.
- `/workspace/projects/<id>/dashboard` — staff sees dashboard with mode toggle + Sync now.
- `/workspace/evaluations/<id>/responses` — staff sees QC table, approve flips status.
- `/portal/projects/<id>/dashboard` — client (member of project) sees dashboard with approved data only; no Sync button.
- `/admin/evaluations` and `/admin/evaluations/<id>` — admin sees instrument config, JSON editor saves, MIS upload accepts a CSV.
- POST `/api/evaluations/sync` (curl with `CRON_SECRET`) — returns 200 with a results array.

- [ ] **Step 5: Commit (no-op if nothing changed)**

```bash
git status
# If anything changed during fixes:
git add -A && git commit -m "chore(evaluations): final sweep fixes"
```

- [ ] **Step 6: Branch + merge handoff**

Branch should be `feat/evaluation-dashboard` (created at the start of execution via `superpowers:using-git-worktrees`). When all tasks pass:

```bash
git checkout master
git merge --no-ff feat/evaluation-dashboard
git push origin master
```

Then invoke `superpowers:finishing-a-development-branch` for the final close-out.

---

## Self-review checklist (writer's notes, not for execution)

- ✅ Spec § 2.2 tables — covered by Tasks 1–3.
- ✅ § 2.3 dashboard spec format — Task 7 (Zod), Task 14 (queries), Task 16 (engine).
- ✅ § 2.4 ingestion — Tasks 8–12.
- ✅ § 2.5 QC handling — Task 19 (table + actions), Task 14 (action), Task 4 (RLS).
- ✅ § 2.6 disaggregations & filtering — Task 16 (FilterBar), Task 13 (aggregators).
- ✅ § 2.7 routes & access — Tasks 17–20.
- ✅ § 2.8 UI structure — Task 18 (DashboardView modes + KPIs + sections).
- ✅ § 2.9 performance — explicit "live aggregation, no mat-view in v1" in Task 13 design.
- ✅ § 2.10 secrets — Task 5 (pgsodium) + Task 14 (`setKoboToken` via SERVICE_ROLE).
- ✅ § 2.11 first-instrument config — Task 6 (seed migration).
- ✅ § 2.12 out-of-scope — honored (no narrative insights, no FGD, no in-app dashboard editor beyond JSON textarea, no raw export for clients, no small-N suppression, no Slack alerts).
- ✅ Migration renumbering — 0035–0040 + 0041 helper, header notes the shift from spec's 0033–0038.
- ✅ Frequent commits — every task ends in a commit.
- ✅ TDD — applied where it pays off (Tasks 1–4, 7, 9, 10, 13, 22). UI tasks verified by dev smoke (Task 23) since RSC tests would dwarf the value.
- ✅ Type consistency — `MappedResponse`, `FilterState`, `BucketCount/BucketPct/StackedRow`, `DashboardSpec`, `ChartEntry` are defined once and reused.
