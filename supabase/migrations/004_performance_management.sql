-- supabase/migrations/004_performance_management.sql

-- ============================================
-- 1. Extend app_module enum
-- ============================================
alter type public.app_module add value if not exists 'performance';

-- ============================================
-- 2. DEPARTMENTS
-- ============================================
create table public.departments (
  id   uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.departments (name) values
  ('MEL'),
  ('IT'),
  ('Admin & HR'),
  ('Finance'),
  ('Marketing & Comms');

-- ============================================
-- 3. USER_DEPARTMENTS
-- ============================================
create table public.user_departments (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.user_profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  is_manager    boolean not null default false,
  unique (user_id)  -- one department per user
);

-- ============================================
-- 4. PERFORMANCE_GOALS
-- ============================================
create table public.performance_goals (
  id            uuid primary key default uuid_generate_v4(),
  department_id uuid not null references public.departments(id) on delete cascade,
  title         text not null,
  description   text,
  year          integer not null,
  quarter       integer not null check (quarter between 1 and 4),
  due_date      date not null,
  created_by    uuid references public.user_profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ============================================
-- 5. PERFORMANCE_ACTIVITIES
-- ============================================
create table public.performance_activities (
  id          uuid primary key default uuid_generate_v4(),
  goal_id     uuid not null references public.performance_goals(id) on delete cascade,
  title       text not null,
  assigned_to uuid references public.user_profiles(id) on delete set null,
  due_date    date not null,
  created_by  uuid references public.user_profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ============================================
-- 6. ACTIVITY_SUBMISSIONS
-- ============================================
create table public.activity_submissions (
  id           uuid primary key default uuid_generate_v4(),
  activity_id  uuid not null references public.performance_activities(id) on delete cascade,
  submitted_by uuid not null references public.user_profiles(id),
  description  text not null,
  submitted_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (activity_id)  -- one submission per activity
);

-- ============================================
-- 7. ACTIVITY_ATTACHMENTS
-- ============================================
create table public.activity_attachments (
  id            uuid primary key default uuid_generate_v4(),
  submission_id uuid not null references public.activity_submissions(id) on delete cascade,
  file_name     text not null,
  file_size     bigint not null,
  storage_path  text not null,
  uploaded_at   timestamptz not null default now()
);

-- ============================================
-- 8. RLS — enable on all tables
-- ============================================
alter table public.departments          enable row level security;
alter table public.user_departments     enable row level security;
alter table public.performance_goals    enable row level security;
alter table public.performance_activities enable row level security;
alter table public.activity_submissions enable row level security;
alter table public.activity_attachments enable row level security;

-- Read: any authenticated user
create policy "auth_read_departments"           on public.departments          for select using (auth.role() = 'authenticated');
create policy "auth_read_user_departments"      on public.user_departments     for select using (auth.role() = 'authenticated');
create policy "auth_read_performance_goals"     on public.performance_goals    for select using (auth.role() = 'authenticated');
create policy "auth_read_performance_activities" on public.performance_activities for select using (auth.role() = 'authenticated');
create policy "auth_read_activity_submissions"  on public.activity_submissions for select using (auth.role() = 'authenticated');
create policy "auth_read_activity_attachments"  on public.activity_attachments for select using (auth.role() = 'authenticated');

-- Write: any authenticated user (app layer enforces business rules)
create policy "auth_write_departments"          on public.departments          for all using (auth.role() = 'authenticated');
create policy "auth_write_user_departments"     on public.user_departments     for all using (auth.role() = 'authenticated');
create policy "auth_write_performance_goals"    on public.performance_goals    for all using (auth.role() = 'authenticated');
create policy "auth_write_performance_activities" on public.performance_activities for all using (auth.role() = 'authenticated');
create policy "auth_write_activity_submissions" on public.activity_submissions for all using (auth.role() = 'authenticated');
create policy "auth_write_activity_attachments" on public.activity_attachments for all using (auth.role() = 'authenticated');

-- ============================================
-- 9. Supabase Storage bucket
-- ============================================
insert into storage.buckets (id, name, public)
values ('performance-attachments', 'performance-attachments', false)
on conflict do nothing;

-- Storage object policies: authenticated users can upload and read their own files
create policy "auth_upload_performance_attachments"
  on storage.objects for insert
  with check (bucket_id = 'performance-attachments' and auth.role() = 'authenticated');

create policy "auth_read_performance_attachments"
  on storage.objects for select
  using (bucket_id = 'performance-attachments' and auth.role() = 'authenticated');

-- ============================================
-- 10. Default permissions for 'performance' module
-- ============================================
-- Admin: allowed
insert into public.role_permissions (role_id, module, allowed)
select id, 'performance', true from public.roles where name = 'Admin';

-- Program Manager: allowed
insert into public.role_permissions (role_id, module, allowed)
select id, 'performance', true from public.roles where name = 'Program Manager';

-- Data Entry Officer: allowed
insert into public.role_permissions (role_id, module, allowed)
select id, 'performance', true from public.roles where name = 'Data Entry Officer';

-- Viewer: not allowed
insert into public.role_permissions (role_id, module, allowed)
select id, 'performance', false from public.roles where name = 'Viewer';

-- ============================================
-- 11. INDEXES
-- ============================================
create index idx_performance_goals_dept_year_quarter
  on public.performance_goals(department_id, year, quarter);

create index idx_performance_activities_goal
  on public.performance_activities(goal_id);

create index idx_performance_activities_assigned_to
  on public.performance_activities(assigned_to);

create index idx_activity_submissions_activity
  on public.activity_submissions(activity_id);

create index idx_activity_attachments_submission
  on public.activity_attachments(submission_id);

create index idx_user_departments_department
  on public.user_departments(department_id);
