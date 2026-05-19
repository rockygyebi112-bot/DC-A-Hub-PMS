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
