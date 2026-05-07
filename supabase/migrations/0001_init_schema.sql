-- DC&A Hub PMS — initial schema
-- Tables: profiles, clients, projects, project_members, phases, activities, activity_proofs, activity_log

create extension if not exists "pgcrypto";

-- profiles ------------------------------------------------------------------
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('admin','staff','client')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_user_id_idx on profiles(user_id);
create index profiles_role_idx on profiles(role);

-- clients -------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- projects ------------------------------------------------------------------
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  client_id uuid not null references clients(id) on delete restrict,
  start_date date,
  end_date date,
  status text not null default 'planning' check (status in ('planning','active','paused','completed')),
  description text,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_client_id_idx on projects(client_id);
create index projects_status_idx on projects(status);

-- project_members -----------------------------------------------------------
create table project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_role text not null check (project_role in ('member','viewer')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index project_members_project_id_idx on project_members(project_id);
create index project_members_user_id_idx on project_members(user_id);

-- phases --------------------------------------------------------------------
create table phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  start_date date,
  end_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index phases_project_id_idx on phases(project_id);
create index phases_order_idx on phases(project_id, order_index);

-- activities ----------------------------------------------------------------
create table activities (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references phases(id) on delete cascade,
  name text not null,
  description text,
  planned_date date,
  completed_date date,
  status text not null default 'not_started' check (status in ('not_started','in_progress','done')),
  location text,
  participants_count int,
  narrative_note text,
  order_index int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activities_phase_id_idx on activities(phase_id);
create index activities_status_idx on activities(status);

-- activity_proofs -----------------------------------------------------------
create table activity_proofs (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  caption text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index activity_proofs_activity_id_idx on activity_proofs(activity_id);

-- activity_log --------------------------------------------------------------
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  activity_id uuid references activities(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created','updated','marked_done','proof_added','proof_deleted')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_project_id_idx on activity_log(project_id);
create index activity_log_activity_id_idx on activity_log(activity_id);

-- updated_at trigger --------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();
create trigger projects_updated_at before update on projects
  for each row execute function set_updated_at();
create trigger phases_updated_at before update on phases
  for each row execute function set_updated_at();
create trigger activities_updated_at before update on activities
  for each row execute function set_updated_at();
