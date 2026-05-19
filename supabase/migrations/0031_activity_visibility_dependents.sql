-- 0031_activity_visibility_dependents.sql
--
-- Closes the side-channel: even after 0030 hid internal activities from
-- the portal, dependent tables (proofs/log/comments/access log) would
-- still leak their existence to viewers. Each SELECT policy now requires
-- the parent activity to be client_visible when the caller is a viewer.

-- ---------- activity_proofs ----------
drop policy if exists activity_proofs_read on activity_proofs;

create policy activity_proofs_read on activity_proofs for select
  using (
    exists (
      select 1
      from activities a
      join phases p on p.id = a.phase_id
      where a.id = activity_proofs.activity_id
        and public.can_access_project(p.project_id)
        and (
          a.visibility = 'client_visible'
          or public.is_admin()
          or exists (
            select 1 from project_members pm
            where pm.project_id = p.project_id
              and pm.user_id = auth.uid()
              and pm.project_role in ('manager','member')
          )
        )
    )
  );

-- ---------- activity_log ----------
-- Existing activity_log_member_read (migration 0017) already restricts to
-- admin/manager/member only — clients never see it, so the visibility
-- filter is not needed for the client-leak case. Leave it unchanged.

-- ---------- proof_comments (migration 0015) ----------
do $$
begin
  if exists (select 1 from pg_policies
              where schemaname='public' and tablename='proof_comments'
                and policyname='proof_comments_read')
  then
    execute 'drop policy proof_comments_read on proof_comments';
  end if;
end$$;

create policy proof_comments_read on proof_comments for select
  using (
    exists (
      select 1
      from activity_proofs pr
      join activities a on a.id = pr.activity_id
      join phases p on p.id = a.phase_id
      where pr.id = proof_comments.proof_id
        and public.can_access_project(p.project_id)
        and (
          a.visibility = 'client_visible'
          or public.is_admin()
          or exists (
            select 1 from project_members pm
            where pm.project_id = p.project_id
              and pm.user_id = auth.uid()
              and pm.project_role in ('manager','member')
          )
        )
    )
  );

-- ---------- proof_access_log (migration 0013) ----------
-- The original migration created two read policies:
--   proof_access_log_admin_read  -- public.is_admin()
--   proof_access_log_member_read -- public.can_access_project(project_id)
-- The "_member_read" form lets viewers (clients) read access-log rows for
-- proofs of internal activities they're members of, leaking existence.
-- Replace both with a single proof_access_log_read that limits non-admins
-- to manager/member project roles only (matches the plan's intent —
-- clients have no business reading the audit trail).
do $$
begin
  if exists (select 1 from pg_policies
              where schemaname='public' and tablename='proof_access_log'
                and policyname='proof_access_log_admin_read')
  then
    execute 'drop policy proof_access_log_admin_read on proof_access_log';
  end if;
  if exists (select 1 from pg_policies
              where schemaname='public' and tablename='proof_access_log'
                and policyname='proof_access_log_member_read')
  then
    execute 'drop policy proof_access_log_member_read on proof_access_log';
  end if;
  if exists (select 1 from pg_policies
              where schemaname='public' and tablename='proof_access_log'
                and policyname='proof_access_log_read')
  then
    execute 'drop policy proof_access_log_read on proof_access_log';
  end if;
end$$;

create policy proof_access_log_read on proof_access_log for select
  using (
    public.is_admin() or exists (
      select 1
      from activity_proofs pr
      join activities a on a.id = pr.activity_id
      join phases p on p.id = a.phase_id
      where pr.id = proof_access_log.proof_id
        and exists (
          select 1 from project_members pm
          where pm.project_id = p.project_id
            and pm.user_id = auth.uid()
            and pm.project_role in ('manager','member')
        )
    )
  );

comment on policy activity_proofs_read on activity_proofs is
  'Clients (viewer) only see proofs of client_visible activities. Staff/admin see all.';
