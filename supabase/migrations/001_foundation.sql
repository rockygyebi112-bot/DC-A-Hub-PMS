-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- ROLES TABLE
-- ============================================
create table public.roles (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

-- Seed default roles
insert into public.roles (name, is_system) values
  ('Admin', true),
  ('Program Manager', true),
  ('Data Entry Officer', true),
  ('Viewer', true);

-- ============================================
-- MODULES ENUM
-- ============================================
create type public.app_module as enum (
  'executive_dashboard',
  'program_dashboards',
  'data_entry',
  'indicators',
  'learnings',
  'settings'
);

-- ============================================
-- ROLE PERMISSIONS TABLE
-- ============================================
create table public.role_permissions (
  id uuid primary key default uuid_generate_v4(),
  role_id uuid not null references public.roles(id) on delete cascade,
  module public.app_module not null,
  allowed boolean not null default false,
  unique (role_id, module)
);

-- Seed default permissions
-- Admin: all modules
insert into public.role_permissions (role_id, module, allowed)
select r.id, m.module, true
from public.roles r,
     unnest(enum_range(null::public.app_module)) as m(module)
where r.name = 'Admin';

-- Program Manager: executive_dashboard, program_dashboards, learnings
insert into public.role_permissions (role_id, module, allowed)
select r.id, m.module,
  case when m.module in ('executive_dashboard', 'program_dashboards', 'learnings') then true else false end
from public.roles r,
     unnest(enum_range(null::public.app_module)) as m(module)
where r.name = 'Program Manager';

-- Data Entry Officer: data_entry only
insert into public.role_permissions (role_id, module, allowed)
select r.id, m.module,
  case when m.module = 'data_entry' then true else false end
from public.roles r,
     unnest(enum_range(null::public.app_module)) as m(module)
where r.name = 'Data Entry Officer';

-- Viewer: executive_dashboard, program_dashboards, learnings
insert into public.role_permissions (role_id, module, allowed)
select r.id, m.module,
  case when m.module in ('executive_dashboard', 'program_dashboards', 'learnings') then true else false end
from public.roles r,
     unnest(enum_range(null::public.app_module)) as m(module)
where r.name = 'Viewer';

-- ============================================
-- USER PROFILES TABLE
-- ============================================
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role_id uuid references public.roles(id),
  status text not null default 'pending' check (status in ('pending', 'active', 'inactive', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- AUDIT LOG TABLE
-- ============================================
create table public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  action text not null,
  details jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ============================================
-- PROGRAMS TABLE
-- ============================================
create table public.programs (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  description text default '',
  created_at timestamptz not null default now()
);

-- Seed programs
insert into public.programs (name, slug, description) values
  ('Enterprise Spotlight', 'enterprise-spotlight', 'Enterprise development program tracking applications and business metrics'),
  ('Virtual University', 'virtual-university', 'Weekly educational episodes aired on Facebook and YouTube'),
  ('Hangout', 'hangout', 'Weekly community engagement episodes on social media platforms'),
  ('ABSA Onboarding', 'absa-onboarding', 'Participant onboarding program with ABSA partnership');

-- ============================================
-- AUTO-CREATE PROFILE ON SIGN-UP (trigger)
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, full_name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'pending'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- User profiles: users can read their own, admins can read/write all
alter table public.user_profiles enable row level security;

create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.user_profiles for select
  using (
    exists (
      select 1 from public.user_profiles up
      join public.roles r on up.role_id = r.id
      where up.id = auth.uid() and r.name = 'Admin'
    )
  );

create policy "Admins can update all profiles"
  on public.user_profiles for update
  using (
    exists (
      select 1 from public.user_profiles up
      join public.roles r on up.role_id = r.id
      where up.id = auth.uid() and r.name = 'Admin'
    )
  );

-- Roles: readable by all authenticated users
alter table public.roles enable row level security;

create policy "Authenticated users can view roles"
  on public.roles for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage roles"
  on public.roles for all
  using (
    exists (
      select 1 from public.user_profiles up
      join public.roles r on up.role_id = r.id
      where up.id = auth.uid() and r.name = 'Admin'
    )
  );

-- Role permissions: readable by all authenticated, writable by admins
alter table public.role_permissions enable row level security;

create policy "Authenticated users can view permissions"
  on public.role_permissions for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage permissions"
  on public.role_permissions for all
  using (
    exists (
      select 1 from public.user_profiles up
      join public.roles r on up.role_id = r.id
      where up.id = auth.uid() and r.name = 'Admin'
    )
  );

-- Programs: readable by all authenticated
alter table public.programs enable row level security;

create policy "Authenticated users can view programs"
  on public.programs for select
  using (auth.role() = 'authenticated');

-- Audit log: admins only
alter table public.audit_log enable row level security;

create policy "Admins can view audit log"
  on public.audit_log for select
  using (
    exists (
      select 1 from public.user_profiles up
      join public.roles r on up.role_id = r.id
      where up.id = auth.uid() and r.name = 'Admin'
    )
  );

create policy "Authenticated users can insert audit log"
  on public.audit_log for insert
  with check (auth.role() = 'authenticated');
