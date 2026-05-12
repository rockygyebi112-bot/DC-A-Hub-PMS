-- DC&A Hub PMS — broaden shares_project_with to cover admin commenters
--
-- Migration 0017 introduced shares_project_with(target_user_id) so the
-- profiles SELECT policy could reveal a teammate's full_name / avatar
-- to anyone who shares a project with them. The original definition only
-- considered project_members on both sides — but admins are NOT inserted
-- into project_members; they implicitly access every project via
-- is_admin(). The result: a client/staff viewer reading a comment posted
-- by an admin still saw "Member" instead of the admin's real name.
--
-- This migration redefines the helper so an admin's profile is visible
-- to any authenticated user who has any project access (i.e. is in at
-- least one project_members row) — which mirrors how can_access_project
-- already treats admins as universally reachable.

create or replace function public.shares_project_with(target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    target_user_id = auth.uid()
    or public.is_admin()
    or (
      -- Target is an admin: visible to anyone with any project access.
      -- Admins are de-facto on every project, so any participant should
      -- be able to see the admin's profile (name, avatar) on comments,
      -- activity feeds, etc.
      exists (
        select 1 from profiles
        where user_id = target_user_id and role = 'admin'
      )
      and (
        exists (select 1 from project_members where user_id = auth.uid())
      )
    )
    or (
      -- Both viewer and target are members of the same project.
      exists (
        select 1
        from project_members me
        join project_members them on them.project_id = me.project_id
        where me.user_id = auth.uid()
          and them.user_id = target_user_id
      )
    );
$$;
