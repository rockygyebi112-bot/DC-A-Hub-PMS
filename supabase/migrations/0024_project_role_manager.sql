-- 0024_project_role_manager.sql
--
-- Adds the 'manager' project_role for the project-manager designation.
--
-- Model:
--   * 'manager' — the designated Project Manager. One per project. Has the
--     same write access as 'member', plus is surfaced to clients as the
--     point-of-contact and is the implicit "owner" of the project from
--     the staff team's perspective.
--   * 'member'  — staff team member. Read + write on phases/activities/
--     proofs (upload workplan, edit, upload documents).
--   * 'viewer'  — client. Read-only.
--
-- We extend the existing CHECK constraint to allow 'manager', enforce
-- at-most-one manager per project via a partial unique index, and update
-- can_write_project + activity_log_member_read so managers get the same
-- write access as members.

-- 1) Allow 'manager' in the existing project_members.project_role check.
alter table project_members
  drop constraint if exists project_members_project_role_check;

alter table project_members
  add constraint project_members_project_role_check
  check (project_role in ('manager', 'member', 'viewer'));

-- 2) Enforce at most one manager per project. Partial index keeps the
--    constraint cheap and lets unlimited members/viewers coexist.
create unique index if not exists project_members_one_manager_per_project
  on project_members (project_id)
  where project_role = 'manager';

-- 3) Managers must be able to write to the project the same way members
--    can. Update the helper used by every write-side RLS policy.
create or replace function public.can_write_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from project_members
    where project_id = p_project_id
      and user_id = auth.uid()
      and project_role in ('manager', 'member')
  );
$$;

-- 4) Managers should also see the activity log (used by the workspace
--    project timeline). Recreate the read policy to include them.
drop policy if exists activity_log_member_read on activity_log;
create policy activity_log_member_read on activity_log for select
  using (
    public.is_admin() or exists (
      select 1 from project_members pm
      where pm.project_id = activity_log.project_id
        and pm.user_id = auth.uid()
        and pm.project_role in ('manager', 'member')
    )
  );

comment on constraint project_members_project_role_check on project_members is
  'Project role: manager (one per project, write), member (staff, write), viewer (client, read).';
