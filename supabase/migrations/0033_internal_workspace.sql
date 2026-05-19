-- 0033_internal_workspace.sql
--
-- Internal Workspace: DC&A Hub's own work that has no client project.
-- Tasks live under admin-configurable areas (BD, HR, Training, Finance,
-- Operations…), with explicit per-task assignees. Clients have no access.
-- Staff see tasks they're assigned to; admin sees all.
--
-- Tables:
--   internal_areas             — top-level buckets (admin-managed)
--   internal_tasks             — work items
--   internal_task_assignees    — many-to-many staff assignment
--
-- v1 omits proofs/comments/recurrence/time-tracking (see spec §1.7).

create table internal_areas (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  description  text,
  color        text,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table internal_tasks (
  id           uuid primary key default gen_random_uuid(),
  area_id      uuid not null references internal_areas(id) on delete restrict,
  project_id   uuid references projects(id) on delete set null,
  title        text not null,
  description  text,
  status       text not null default 'not_started'
                 check (status in ('not_started','in_progress','blocked','done')),
  priority     text check (priority in ('low','normal','high','urgent')),
  due_date     date,
  created_by   uuid references auth.users(id) on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index internal_tasks_area_idx       on internal_tasks(area_id);
create index internal_tasks_status_idx     on internal_tasks(status);
create index internal_tasks_project_idx    on internal_tasks(project_id) where project_id is not null;

create table internal_task_assignees (
  task_id  uuid not null references internal_tasks(id) on delete cascade,
  user_id  uuid not null references auth.users(id)    on delete cascade,
  added_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index internal_task_assignees_user_idx on internal_task_assignees(user_id);

-- updated_at triggers (reuse set_updated_at from 0001)
create trigger internal_areas_updated_at  before update on internal_areas
  for each row execute function set_updated_at();
create trigger internal_tasks_updated_at  before update on internal_tasks
  for each row execute function set_updated_at();

-- Seed default areas
insert into internal_areas (name, color) values
  ('Business Development', '#7c3aed'),
  ('HR & Recruitment',     '#10b981'),
  ('Internal Training',    '#3b82f6'),
  ('Finance & Admin',      '#f59e0b'),
  ('Operations',           '#64748b');

-- RLS ----------------------------------------------------------------
alter table internal_areas            enable row level security;
alter table internal_tasks            enable row level security;
alter table internal_task_assignees   enable row level security;

-- helper: is the current user staff or admin?
create or replace function public.is_staff_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role in ('admin','staff')
  );
$$;

create policy internal_areas_read on internal_areas for select
  using (public.is_staff_or_admin());
create policy internal_areas_admin_write on internal_areas for all
  using (public.is_admin()) with check (public.is_admin());

create policy internal_tasks_read on internal_tasks for select
  using (
    public.is_admin()
    or exists (
      select 1 from internal_task_assignees ta
      where ta.task_id = internal_tasks.id
        and ta.user_id = auth.uid()
    )
  );

create policy internal_tasks_admin_write on internal_tasks for all
  using (public.is_admin()) with check (public.is_admin());

create policy internal_tasks_assignee_update on internal_tasks for update
  using (
    exists (
      select 1 from internal_task_assignees ta
      where ta.task_id = internal_tasks.id and ta.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from internal_task_assignees ta
      where ta.task_id = internal_tasks.id and ta.user_id = auth.uid()
    )
  );

create policy internal_task_assignees_read on internal_task_assignees for select
  using (
    public.is_admin() or user_id = auth.uid()
    or exists (
      select 1 from internal_task_assignees self
      where self.task_id = internal_task_assignees.task_id
        and self.user_id = auth.uid()
    )
  );

create policy internal_task_assignees_admin_write on internal_task_assignees for all
  using (public.is_admin()) with check (public.is_admin());

create policy internal_task_assignees_assignee_write on internal_task_assignees for insert
  with check (
    exists (
      select 1 from internal_task_assignees self
      where self.task_id = internal_task_assignees.task_id
        and self.user_id = auth.uid()
    )
  );

comment on table internal_tasks is
  'DC&A Hub internal work items grouped by area; never visible to clients.';
