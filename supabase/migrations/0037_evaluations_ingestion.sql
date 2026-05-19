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
