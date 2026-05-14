-- 0023_project_activity_counts_security_invoker.sql
--
-- Security audit C-2: the view created in 0021 was a regular (non
-- security_invoker) Postgres view. Such views run with the *owner's*
-- privileges, which in Supabase means the migration role (effectively a
-- superuser) — bypassing RLS on the underlying `projects`, `phases`, and
-- `activities` tables. The migration's comment claimed otherwise; this
-- migration corrects the behaviour so the view truly reflects only the
-- rows the calling user is permitted to see via RLS.
--
-- Without this fix, any authenticated user (including a low-privilege
-- portal/client viewer) could `select * from project_activity_counts`
-- and enumerate every project_id in the organisation along with their
-- per-status activity counts.
--
-- Postgres 15+ supports `security_invoker` directly on views.

alter view public.project_activity_counts set (security_invoker = true);

comment on view public.project_activity_counts is
  'Per-project rollup of activity counts by status. security_invoker=true so RLS on projects/phases/activities is enforced for the calling user.';
