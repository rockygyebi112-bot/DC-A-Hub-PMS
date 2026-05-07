-- DC&A Hub PMS — RLS policies

-- helper: is the current user an admin? -------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- helper: can the current user access a project (any membership) ----------
create or replace function public.can_access_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$;

-- helper: can the current user write to a project (member only) -----------
create or replace function public.can_write_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from project_members
    where project_id = p_project_id
      and user_id = auth.uid()
      and project_role = 'member'
  );
$$;

-- enable RLS on every table -------------------------------------------------
alter table profiles enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table phases enable row level security;
alter table activities enable row level security;
alter table activity_proofs enable row level security;
alter table activity_log enable row level security;

-- profiles ------------------------------------------------------------------
create policy profiles_self_read on profiles for select
  using (user_id = auth.uid() or public.is_admin());

create policy profiles_self_update on profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy profiles_admin_all on profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- clients -------------------------------------------------------------------
create policy clients_admin_all on clients for all
  using (public.is_admin()) with check (public.is_admin());

create policy clients_member_read on clients for select
  using (
    exists (
      select 1 from projects p
      join project_members pm on pm.project_id = p.id
      where p.client_id = clients.id and pm.user_id = auth.uid()
    )
  );

-- projects ------------------------------------------------------------------
create policy projects_admin_all on projects for all
  using (public.is_admin()) with check (public.is_admin());

create policy projects_member_read on projects for select
  using (public.can_access_project(id));

create policy projects_member_write on projects for update
  using (public.can_write_project(id))
  with check (public.can_write_project(id));

-- project_members -----------------------------------------------------------
create policy project_members_admin_all on project_members for all
  using (public.is_admin()) with check (public.is_admin());

create policy project_members_self_read on project_members for select
  using (user_id = auth.uid() or public.can_access_project(project_id));

-- phases --------------------------------------------------------------------
create policy phases_read on phases for select
  using (public.can_access_project(project_id));

create policy phases_write on phases for all
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

-- activities ----------------------------------------------------------------
create policy activities_read on activities for select
  using (
    public.can_access_project(
      (select project_id from phases where phases.id = activities.phase_id)
    )
  );

create policy activities_write on activities for all
  using (
    public.can_write_project(
      (select project_id from phases where phases.id = activities.phase_id)
    )
  )
  with check (
    public.can_write_project(
      (select project_id from phases where phases.id = activities.phase_id)
    )
  );

-- activity_proofs -----------------------------------------------------------
create policy activity_proofs_read on activity_proofs for select
  using (
    public.can_access_project(
      (select p.project_id from phases p
        join activities a on a.phase_id = p.id
        where a.id = activity_proofs.activity_id)
    )
  );

create policy activity_proofs_write on activity_proofs for all
  using (
    public.can_write_project(
      (select p.project_id from phases p
        join activities a on a.phase_id = p.id
        where a.id = activity_proofs.activity_id)
    )
  )
  with check (
    public.can_write_project(
      (select p.project_id from phases p
        join activities a on a.phase_id = p.id
        where a.id = activity_proofs.activity_id)
    )
  );

-- activity_log --------------------------------------------------------------
create policy activity_log_member_read on activity_log for select
  using (
    public.is_admin() or exists (
      select 1 from project_members pm
      where pm.project_id = activity_log.project_id
        and pm.user_id = auth.uid()
        and pm.project_role = 'member'
    )
  );

create policy activity_log_write on activity_log for insert
  with check (public.can_write_project(project_id));
