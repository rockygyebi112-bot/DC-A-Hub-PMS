-- ============================================
-- Shared access helpers
-- ============================================
create or replace function public.user_has_module_access(
  uid uuid,
  target_module public.app_module
)
returns boolean as $$
  select exists (
    select 1
    from public.user_profiles up
    join public.role_permissions rp on rp.role_id = up.role_id
    where up.id = uid
      and up.status = 'active'
      and rp.module = target_module
      and rp.allowed = true
  );
$$ language sql security definer stable;

create or replace function public.is_mel_manager(uid uuid)
returns boolean as $$
  select exists (
    select 1
    from public.user_profiles up
    join public.roles r on up.role_id = r.id
    where up.id = uid
      and up.status = 'active'
      and r.name in ('Admin', 'Program Manager')
  );
$$ language sql security definer stable;

create or replace function public.is_activity_owner(activity_uuid uuid, uid uuid)
returns boolean as $$
  select exists (
    select 1
    from public.project_activities pa
    where pa.id = activity_uuid
      and pa.owner_user_id = uid
  );
$$ language sql security definer stable;

create or replace function public.can_upload_project_proof(object_name text)
returns boolean as $$
  select coalesce(
    public.is_mel_manager(auth.uid()) or exists (
      select 1
      from public.project_activities pa
      where pa.id::text = split_part(object_name, '/', 2)
        and pa.owner_user_id = auth.uid()
    ),
    false
  );
$$ language sql security definer stable;

create or replace function public.can_delete_project_proof(_object_name text)
returns boolean as $$
  select public.is_mel_manager(auth.uid());
$$ language sql security definer stable;

-- ============================================
-- User directory access for projects
-- ============================================
create policy "Project users can view active profiles"
  on public.user_profiles for select
  using (
    status = 'active'
    and public.user_has_module_access(auth.uid(), 'projects')
  );

-- ============================================
-- Dashboard/reporting selects
-- ============================================
drop policy if exists "Users can view own ES entries" on public.enterprise_spotlight_entries;
create policy "Users can view ES entries they can access"
  on public.enterprise_spotlight_entries for select
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or public.user_has_module_access(auth.uid(), 'program_dashboards')
    or public.user_has_module_access(auth.uid(), 'executive_dashboard')
  );

drop policy if exists "Users can view own VU entries" on public.virtual_university_entries;
create policy "Users can view VU entries they can access"
  on public.virtual_university_entries for select
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or public.user_has_module_access(auth.uid(), 'program_dashboards')
    or public.user_has_module_access(auth.uid(), 'executive_dashboard')
  );

drop policy if exists "Users can view own Hangout entries" on public.hangout_entries;
create policy "Users can view Hangout entries they can access"
  on public.hangout_entries for select
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or public.user_has_module_access(auth.uid(), 'program_dashboards')
    or public.user_has_module_access(auth.uid(), 'executive_dashboard')
  );

drop policy if exists "Users can view own ABSA entries" on public.absa_onboarding_entries;
create policy "Users can view ABSA entries they can access"
  on public.absa_onboarding_entries for select
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or public.user_has_module_access(auth.uid(), 'program_dashboards')
    or public.user_has_module_access(auth.uid(), 'executive_dashboard')
  );

drop policy if exists "Authenticated users can view learnings" on public.learnings;
create policy "Users can view learnings they can access"
  on public.learnings for select
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
    or public.user_has_module_access(auth.uid(), 'learnings')
  );

-- ============================================
-- Projects role permissions
-- ============================================
update public.role_permissions rp
set allowed = true
from public.roles r
where rp.role_id = r.id
  and rp.module = 'projects'
  and r.name in ('Admin', 'Program Manager', 'Viewer');

update public.role_permissions rp
set allowed = false
from public.roles r
where rp.role_id = r.id
  and rp.module = 'projects'
  and r.name = 'Data Entry Officer';

-- ============================================
-- Project RLS policies
-- ============================================
drop policy if exists "auth_read_projects" on public.projects;
drop policy if exists "auth_write_projects" on public.projects;
drop policy if exists "auth_read_project_milestones" on public.project_milestones;
drop policy if exists "auth_write_project_milestones" on public.project_milestones;
drop policy if exists "auth_read_project_activities" on public.project_activities;
drop policy if exists "auth_write_project_activities" on public.project_activities;
drop policy if exists "auth_read_project_updates" on public.project_activity_updates;
drop policy if exists "auth_write_project_updates" on public.project_activity_updates;
drop policy if exists "auth_read_project_attachments" on public.project_activity_attachments;
drop policy if exists "auth_write_project_attachments" on public.project_activity_attachments;

create policy "Users can view projects they can access"
  on public.projects for select
  using (public.user_has_module_access(auth.uid(), 'projects'));

create policy "MEL managers can insert projects"
  on public.projects for insert
  with check (public.is_mel_manager(auth.uid()));

create policy "MEL managers can update projects"
  on public.projects for update
  using (public.is_mel_manager(auth.uid()))
  with check (public.is_mel_manager(auth.uid()));

create policy "MEL managers can delete projects"
  on public.projects for delete
  using (public.is_mel_manager(auth.uid()));

create policy "Users can view milestones they can access"
  on public.project_milestones for select
  using (public.user_has_module_access(auth.uid(), 'projects'));

create policy "MEL managers can insert milestones"
  on public.project_milestones for insert
  with check (public.is_mel_manager(auth.uid()));

create policy "MEL managers can update milestones"
  on public.project_milestones for update
  using (public.is_mel_manager(auth.uid()))
  with check (public.is_mel_manager(auth.uid()));

create policy "MEL managers can delete milestones"
  on public.project_milestones for delete
  using (public.is_mel_manager(auth.uid()));

create policy "Users can view activities they can access"
  on public.project_activities for select
  using (public.user_has_module_access(auth.uid(), 'projects'));

create policy "MEL managers can insert activities"
  on public.project_activities for insert
  with check (public.is_mel_manager(auth.uid()));

create policy "Owners and MEL managers can update activities"
  on public.project_activities for update
  using (
    public.is_mel_manager(auth.uid())
    or owner_user_id = auth.uid()
  )
  with check (
    public.is_mel_manager(auth.uid())
    or owner_user_id = auth.uid()
  );

create policy "MEL managers can delete activities"
  on public.project_activities for delete
  using (public.is_mel_manager(auth.uid()));

create policy "Users can view activity updates they can access"
  on public.project_activity_updates for select
  using (public.user_has_module_access(auth.uid(), 'projects'));

create policy "Owners and MEL managers can insert activity updates"
  on public.project_activity_updates for insert
  with check (
    user_id = auth.uid()
    and (
      public.is_mel_manager(auth.uid())
      or public.is_activity_owner(activity_id, auth.uid())
    )
  );

create policy "Users can view attachments they can access"
  on public.project_activity_attachments for select
  using (public.user_has_module_access(auth.uid(), 'projects'));

create policy "Owners and MEL managers can insert attachments"
  on public.project_activity_attachments for insert
  with check (
    uploaded_by = auth.uid()
    and (
      public.is_mel_manager(auth.uid())
      or public.is_activity_owner(activity_id, auth.uid())
    )
  );

create policy "MEL managers can delete attachments"
  on public.project_activity_attachments for delete
  using (public.is_mel_manager(auth.uid()));

-- ============================================
-- Storage policies for project proofs
-- ============================================
drop policy if exists "auth_upload_project_proofs" on storage.objects;
drop policy if exists "auth_read_project_proofs" on storage.objects;
drop policy if exists "auth_delete_project_proofs" on storage.objects;

create policy "auth_upload_project_proofs"
  on storage.objects for insert
  with check (
    bucket_id = 'project-activity-proofs'
    and public.can_upload_project_proof(name)
  );

create policy "auth_read_project_proofs"
  on storage.objects for select
  using (
    bucket_id = 'project-activity-proofs'
    and public.user_has_module_access(auth.uid(), 'projects')
  );

create policy "auth_delete_project_proofs"
  on storage.objects for delete
  using (
    bucket_id = 'project-activity-proofs'
    and public.can_delete_project_proof(name)
  );

-- ============================================
-- Enforce owner-safe project activity updates
-- ============================================
create or replace function public.enforce_project_activity_update_scope()
returns trigger
language plpgsql
as $$
begin
  if public.is_mel_manager(auth.uid()) then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = 'insufficient_privilege';
  end if;

  if old.owner_user_id is distinct from auth.uid() then
    raise exception 'Only the assigned owner or a MEL manager can update this activity.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.project_id is distinct from old.project_id
     or new.milestone_id is distinct from old.milestone_id
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.owner_user_id is distinct from old.owner_user_id
     or new.due_date is distinct from old.due_date
     or new.priority is distinct from old.priority
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Activity owners can only update status, percent complete, and the latest update text.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_project_activity_update_scope on public.project_activities;
create trigger trg_enforce_project_activity_update_scope
before update on public.project_activities
for each row execute function public.enforce_project_activity_update_scope();

-- ============================================
-- Keep project timestamps current
-- ============================================
drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists set_project_activities_updated_at on public.project_activities;
create trigger set_project_activities_updated_at before update on public.project_activities
  for each row execute function public.set_updated_at();
