-- 0030_activity_visibility.sql
--
-- Adds the per-activity visibility flag that separates client-facing work
-- from internal DC&A Hub work hidden inside the same project. The portal
-- (project_role='viewer') must never see 'internal' rows; admin, manager,
-- and member roles see both.
--
-- We extend the existing activities_read policy with a viewer-only filter.
-- The write policy is unchanged: writers (admin/manager/member) can flip
-- visibility either direction.

alter table activities
  add column visibility text not null default 'client_visible'
    check (visibility in ('client_visible', 'internal'));

create index activities_visibility_idx on activities (visibility);

comment on column activities.visibility is
  'client_visible = portal sees it; internal = hidden from portal, visible to admin/manager/member.';

-- Replace activities_read so viewers only get client_visible rows.
drop policy if exists activities_read on activities;

create policy activities_read on activities for select
  using (
    public.can_access_project(
      (select project_id from phases where phases.id = activities.phase_id)
    )
    and (
      visibility = 'client_visible'
      or public.is_admin()
      or exists (
        select 1 from project_members pm
        where pm.project_id = (
                select project_id from phases where phases.id = activities.phase_id
              )
          and pm.user_id = auth.uid()
          and pm.project_role in ('manager', 'member')
      )
    )
  );

comment on policy activities_read on activities is
  'Clients (viewer role) only see client_visible activities. Admin/manager/member see all.';
