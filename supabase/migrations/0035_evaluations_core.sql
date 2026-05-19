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
