-- 0022_security_hardening_rls.sql
--
-- Hardening pass surfaced by the senior-security audit (2026-05-14).
--
-- 1) project_activity_counts view — convert to security_invoker so it
--    respects RLS on its underlying tables. As shipped (regular view) it
--    ran with the migration role's privileges, which bypasses RLS and
--    leaks every project_id + activity-count rollup to every authenticated
--    user, including client viewers who shouldn't see projects outside
--    their membership.
--
-- 2) public.is_admin() — was added in 0002, before profiles.is_active
--    existed (0005). It only checked role='admin' so a deactivated admin
--    whose JWT had not yet refreshed still passed every RLS policy gated
--    on is_admin(). Adds the is_active check and qualifies the table name
--    so future search_path tricks can't shadow it.

alter view project_activity_counts set (security_invoker = true);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.profiles
     where user_id = auth.uid()
       and role = 'admin'
       and is_active = true
  );
$$;

comment on function public.is_admin() is
  'True if the caller is an active admin. Used by RLS policies across the app. Deactivated admins (is_active=false) are NOT admins for RLS purposes — this matches the application-layer requireAdmin() check.';
