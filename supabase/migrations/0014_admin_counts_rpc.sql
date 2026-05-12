-- DC&A Hub PMS — admin dashboard counts RPC
--
-- Replaces 14 separate `select count(*)` HTTP round-trips fired from the
-- admin layout + dashboard page with a single `select admin_counts()` call.
-- Postgres can compute all 14 numbers in one pass over each table using
-- aggregate FILTER clauses, so this is dramatically cheaper end-to-end.
--
-- Locked down with `security definer` + an admin check so it can run with
-- bypass-RLS privileges (counts must be computed across the whole org, not
-- just the caller's row-visibility set) without exposing any data to
-- non-admin callers.

create or replace function public.admin_counts()
returns table (
  active_clients              bigint,
  active_projects             bigint,
  total_users                 bigint,
  pending_invites             bigint,
  total_projects_current      bigint,
  active_projects_current     bigint,
  completed_projects_current  bigint,
  paused_projects_current     bigint,
  total_users_current         bigint,
  total_projects_prev         bigint,
  active_projects_prev        bigint,
  completed_projects_prev     bigint,
  paused_projects_prev        bigint,
  total_users_prev            bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  seven_days_ago  timestamptz := now() - interval '7 days';
  thirty_days_ago timestamptz := now() - interval '30 days';
begin
  if not public.is_admin() then
    raise exception 'admin_counts: caller is not an admin'
      using errcode = '42501';
  end if;

  return query
  with
    project_stats as (
      select
        count(*) filter (where archived_at is null)                                              as total_current,
        count(*) filter (where archived_at is null and status = 'active')                        as active_current,
        count(*) filter (where archived_at is null and status = 'completed')                     as completed_current,
        count(*) filter (where archived_at is null and status = 'paused')                        as paused_current,
        count(*) filter (where created_at < thirty_days_ago)                                     as total_prev,
        count(*) filter (where created_at < thirty_days_ago and status = 'active')               as active_prev,
        count(*) filter (where created_at < thirty_days_ago and status = 'completed')            as completed_prev,
        count(*) filter (where created_at < thirty_days_ago and status = 'paused')               as paused_prev
      from public.projects
    ),
    profile_stats as (
      select
        count(*) filter (where is_active = true)            as users_current,
        count(*) filter (where created_at >= seven_days_ago) as recent_invites,
        count(*) filter (where created_at < thirty_days_ago) as users_prev
      from public.profiles
    ),
    client_stats as (
      select count(*) filter (where archived_at is null) as active_clients
      from public.clients
    )
  select
    client_stats.active_clients,
    project_stats.active_current     as active_projects,
    profile_stats.users_current      as total_users,
    profile_stats.recent_invites     as pending_invites,
    project_stats.total_current      as total_projects_current,
    project_stats.active_current     as active_projects_current,
    project_stats.completed_current  as completed_projects_current,
    project_stats.paused_current     as paused_projects_current,
    profile_stats.users_current      as total_users_current,
    project_stats.total_prev         as total_projects_prev,
    project_stats.active_prev        as active_projects_prev,
    project_stats.completed_prev     as completed_projects_prev,
    project_stats.paused_prev        as paused_projects_prev,
    profile_stats.users_prev         as total_users_prev
  from project_stats, profile_stats, client_stats;
end;
$$;

revoke all on function public.admin_counts() from public;
grant execute on function public.admin_counts() to authenticated;
