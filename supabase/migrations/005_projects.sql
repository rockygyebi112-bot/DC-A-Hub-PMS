-- supabase/migrations/005_projects.sql

-- ============================================
-- 1. Drop performance management (from 004)
-- ============================================
-- Drop storage policies for performance
-- NOTE: Supabase blocks direct deletes from storage.objects / storage.buckets.
-- Remove the old `performance-attachments` bucket manually via the Storage UI
-- (Supabase Dashboard → Storage → delete bucket) or via the Storage API.
drop policy if exists "auth_upload_performance_attachments" on storage.objects;
drop policy if exists "auth_read_performance_attachments"   on storage.objects;

-- Drop performance RLS policies
drop policy if exists "auth_read_departments"               on public.departments;
drop policy if exists "auth_read_user_departments"          on public.user_departments;
drop policy if exists "auth_read_performance_goals"         on public.performance_goals;
drop policy if exists "auth_read_performance_activities"    on public.performance_activities;
drop policy if exists "auth_read_activity_submissions"      on public.activity_submissions;
drop policy if exists "auth_read_activity_attachments"      on public.activity_attachments;
drop policy if exists "auth_write_departments"              on public.departments;
drop policy if exists "auth_write_user_departments"         on public.user_departments;
drop policy if exists "auth_write_performance_goals"        on public.performance_goals;
drop policy if exists "auth_write_performance_activities"   on public.performance_activities;
drop policy if exists "auth_write_activity_submissions"     on public.activity_submissions;
drop policy if exists "auth_write_activity_attachments"     on public.activity_attachments;

-- Drop performance tables in reverse FK order
drop table if exists public.activity_attachments    cascade;
drop table if exists public.activity_submissions    cascade;
drop table if exists public.performance_activities  cascade;
drop table if exists public.performance_goals       cascade;
drop table if exists public.user_departments        cascade;
drop table if exists public.departments             cascade;

-- Remove performance role permissions
delete from public.role_permissions where module = 'performance';

-- ============================================
-- 2. Extend app_module enum with 'projects'
-- ============================================
-- NOTE: the 'projects' enum value is added in 005a_projects_enum.sql, which
-- MUST be run first. Postgres forbids using a new enum value in the same
-- transaction it was added, so the ALTER TYPE lives in its own migration.

-- ============================================
-- 3. PROJECTS
-- ============================================
create table public.projects (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  slug              text not null unique,
  description       text,
  owner_user_id     uuid references public.user_profiles(id) on delete set null,
  program_slug      text,
  start_date        date,
  target_end_date   date,
  status_override   text check (status_override in ('blocked','done')),
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================
-- 4. PROJECT_MILESTONES
-- ============================================
create table public.project_milestones (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  name         text not null,
  order_index  int  not null default 0,
  created_at   timestamptz not null default now()
);

-- ============================================
-- 5. PROJECT_ACTIVITIES
-- ============================================
create table public.project_activities (
  id                uuid primary key default uuid_generate_v4(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  milestone_id      uuid references public.project_milestones(id) on delete set null,
  title             text not null,
  description       text,
  owner_user_id     uuid references public.user_profiles(id) on delete set null,
  due_date          date,
  status            text not null default 'not_started'
                    check (status in ('not_started','in_progress','done','blocked')),
  priority          text not null default 'medium'
                    check (priority in ('low','medium','high')),
  percent_complete  int  not null default 0 check (percent_complete between 0 and 100),
  last_update_text  text,
  last_update_at    timestamptz,
  created_by        uuid references public.user_profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================
-- 6. PROJECT_ACTIVITY_UPDATES (audit log)
-- ============================================
create table public.project_activity_updates (
  id              uuid primary key default uuid_generate_v4(),
  activity_id     uuid not null references public.project_activities(id) on delete cascade,
  user_id         uuid not null references public.user_profiles(id) on delete cascade,
  note            text not null,
  status_before   text,
  status_after    text,
  created_at      timestamptz not null default now()
);

-- ============================================
-- 7. PROJECT_ACTIVITY_ATTACHMENTS (proof of activity)
-- ============================================
create table public.project_activity_attachments (
  id             uuid primary key default uuid_generate_v4(),
  activity_id    uuid not null references public.project_activities(id) on delete cascade,
  uploaded_by    uuid references public.user_profiles(id) on delete set null,
  file_path      text not null,
  file_name      text not null,
  mime_type      text not null,
  size_bytes     bigint not null,
  caption        text,
  created_at     timestamptz not null default now()
);

-- ============================================
-- 8. Trigger: proof required to mark Done
-- ============================================
create or replace function public.enforce_proof_before_done()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and (old.status is distinct from 'done') then
    if not exists (
      select 1 from public.project_activity_attachments
       where activity_id = new.id
    ) then
      raise exception 'At least one proof-of-activity attachment is required before marking an activity as Done (activity_id=%).', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_proof_before_done
before update on public.project_activities
for each row execute function public.enforce_proof_before_done();

-- ============================================
-- 9. Indexes
-- ============================================
create index idx_project_activities_project     on public.project_activities(project_id);
create index idx_project_activities_owner       on public.project_activities(owner_user_id);
create index idx_project_activities_due_date    on public.project_activities(due_date);
create index idx_project_activities_status      on public.project_activities(status);
create index idx_project_activity_updates_act   on public.project_activity_updates(activity_id);
create index idx_project_activity_attach_act    on public.project_activity_attachments(activity_id);
create index idx_project_milestones_project     on public.project_milestones(project_id);

-- ============================================
-- 10. RLS
-- ============================================
alter table public.projects                      enable row level security;
alter table public.project_milestones            enable row level security;
alter table public.project_activities            enable row level security;
alter table public.project_activity_updates      enable row level security;
alter table public.project_activity_attachments  enable row level security;

create policy "auth_read_projects"               on public.projects                      for select using (auth.role() = 'authenticated');
create policy "auth_write_projects"              on public.projects                      for all    using (auth.role() = 'authenticated');
create policy "auth_read_project_milestones"     on public.project_milestones            for select using (auth.role() = 'authenticated');
create policy "auth_write_project_milestones"    on public.project_milestones            for all    using (auth.role() = 'authenticated');
create policy "auth_read_project_activities"     on public.project_activities            for select using (auth.role() = 'authenticated');
create policy "auth_write_project_activities"    on public.project_activities            for all    using (auth.role() = 'authenticated');
create policy "auth_read_project_updates"        on public.project_activity_updates      for select using (auth.role() = 'authenticated');
create policy "auth_write_project_updates"       on public.project_activity_updates      for all    using (auth.role() = 'authenticated');
create policy "auth_read_project_attachments"    on public.project_activity_attachments  for select using (auth.role() = 'authenticated');
create policy "auth_write_project_attachments"   on public.project_activity_attachments  for all    using (auth.role() = 'authenticated');

-- ============================================
-- 11. Storage bucket: project-activity-proofs
-- ============================================
insert into storage.buckets (id, name, public)
values ('project-activity-proofs', 'project-activity-proofs', false)
on conflict do nothing;

create policy "auth_upload_project_proofs"
  on storage.objects for insert
  with check (bucket_id = 'project-activity-proofs' and auth.role() = 'authenticated');

create policy "auth_read_project_proofs"
  on storage.objects for select
  using (bucket_id = 'project-activity-proofs' and auth.role() = 'authenticated');

create policy "auth_delete_project_proofs"
  on storage.objects for delete
  using (bucket_id = 'project-activity-proofs' and auth.role() = 'authenticated');

-- ============================================
-- 12. Role permissions for 'projects' module
-- ============================================
insert into public.role_permissions (role_id, module, allowed)
select id, 'projects', true  from public.roles where name = 'Admin';
insert into public.role_permissions (role_id, module, allowed)
select id, 'projects', true  from public.roles where name = 'Program Manager';
insert into public.role_permissions (role_id, module, allowed)
select id, 'projects', true  from public.roles where name = 'Data Entry Officer';
insert into public.role_permissions (role_id, module, allowed)
select id, 'projects', true  from public.roles where name = 'Viewer';

-- ============================================
-- 13. Seed projects
-- ============================================
insert into public.projects (name, slug, description, program_slug) values
  ('Enterprise Spotlight',  'enterprise-spotlight',  'Track progress of the Enterprise Spotlight project.', 'enterprise-spotlight'),
  ('ABSA Onboarding',       'absa-onboarding',       'Track progress of the ABSA Onboarding project.',      'absa-onboarding'),
  ('Nkabom Collaborative',  'nkabom-collaborative',  'Track progress of the Nkabom Collaborative project.', null)
on conflict (slug) do nothing;
