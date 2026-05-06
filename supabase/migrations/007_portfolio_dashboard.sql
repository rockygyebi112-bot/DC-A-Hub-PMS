-- supabase/migrations/007_portfolio_dashboard.sql
-- Portfolio dashboard: completion timestamp + RPC aggregations.

-- ============================================
-- 1. completed_at column on project_activities
-- ============================================
alter table public.project_activities
  add column if not exists completed_at timestamptz;

create index if not exists idx_project_activities_completed_at
  on public.project_activities(completed_at);

-- Trigger: keep completed_at in sync with status transitions to/from 'done'.
create or replace function public.sync_activity_completed_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'done' and new.completed_at is null then
      new.completed_at := now();
    end if;
    return new;
  end if;

  -- UPDATE
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' and old.status = 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_activity_completed_at on public.project_activities;
create trigger trg_sync_activity_completed_at
before insert or update on public.project_activities
for each row execute function public.sync_activity_completed_at();

-- One-time backfill: best-effort historical completion timestamp.
update public.project_activities
   set completed_at = updated_at
 where status = 'done'
   and completed_at is null;

-- ============================================
-- 2. RPC: rpc_portfolio_health(program_slug)
-- ============================================
-- Returns one row with the four KPI counts. Uses the same status logic
-- as src/lib/projects/status.ts (kept in sync manually — see spec).
--
-- Computed project status:
--   blocked   -> projects.status_override = 'blocked'
--   done      -> all activities done AND at least one activity exists
--   at_risk   -> any activity overdue OR (priority='high' AND status='blocked')
--   in_progress -> any activity not 'not_started'
--   not_started -> otherwise

create or replace function public.rpc_portfolio_health(p_program_slug text default null)
returns table (
  active_projects        bigint,
  done_projects          bigint,
  on_track_count         bigint,
  at_risk_or_blocked     bigint,
  overdue_activities     bigint
)
language sql
stable
security invoker
as $$
  with proj as (
    select p.id, p.status_override
      from public.projects p
     where p.archived_at is null
       and (p_program_slug is null or p.program_slug = p_program_slug)
  ),
  acts as (
    select a.project_id, a.status, a.priority, a.due_date
      from public.project_activities a
     where a.project_id in (select id from proj)
  ),
  per_project as (
    select
      pr.id,
      pr.status_override,
      count(a.*)                                      as total_activities,
      count(a.*) filter (where a.status = 'done')     as done_activities,
      bool_or(
        a.due_date is not null
        and a.status <> 'done'
        and a.due_date < current_date
      ) as has_overdue,
      bool_or(a.priority = 'high' and a.status = 'blocked') as has_high_blocked,
      bool_or(a.status <> 'not_started')              as has_started
    from proj pr
    left join acts a on a.project_id = pr.id
    group by pr.id, pr.status_override
  ),
  classified as (
    select
      id,
      case
        when total_activities > 0 and done_activities = total_activities then 'done'
        when status_override = 'blocked' then 'blocked'
        when coalesce(has_overdue, false) or coalesce(has_high_blocked, false) then 'at_risk'
        when coalesce(has_started, false) then 'in_progress'
        else 'not_started'
      end as computed_status
    from per_project
  )
  select
    (select count(*) from classified where computed_status <> 'done')                         as active_projects,
    (select count(*) from classified where computed_status = 'done')                          as done_projects,
    (select count(*) from classified where computed_status in ('not_started','in_progress'))  as on_track_count,
    (select count(*) from classified where computed_status in ('at_risk','blocked'))          as at_risk_or_blocked,
    (select count(*) from public.project_activities a
       join proj pr on pr.id = a.project_id
      where a.due_date is not null
        and a.status <> 'done'
        and a.due_date < current_date)                                                        as overdue_activities;
$$;

grant execute on function public.rpc_portfolio_health(text) to authenticated;

-- ============================================
-- 3. RPC: rpc_projects_requiring_attention(program_slug, limit)
-- ============================================
-- Returns one row per project that needs attention, scored worst-first.
-- score = overdue*2 + blocked_acts*3 + (at_risk?5:0) + (blocked_status?8:0)

create or replace function public.rpc_projects_requiring_attention(
  p_program_slug text default null,
  p_limit int default 10
)
returns table (
  project_id        uuid,
  project_name      text,
  project_slug      text,
  computed_status   text,
  percent_complete  int,
  overdue_count     int,
  blocked_count     int,
  owner_full_name   text,
  score             int
)
language sql
stable
security invoker
as $$
  with proj as (
    select p.id, p.name, p.slug, p.status_override, p.owner_user_id
      from public.projects p
     where p.archived_at is null
       and (p_program_slug is null or p.program_slug = p_program_slug)
  ),
  agg as (
    select
      pr.id,
      pr.name,
      pr.slug,
      pr.status_override,
      pr.owner_user_id,
      count(a.*)                                      as total_acts,
      count(a.*) filter (where a.status = 'done')     as done_acts,
      count(a.*) filter (
        where a.due_date is not null
          and a.status <> 'done'
          and a.due_date < current_date
      )                                               as overdue_acts,
      count(a.*) filter (where a.status = 'blocked')  as blocked_acts,
      bool_or(a.priority = 'high' and a.status = 'blocked') as has_high_blocked,
      coalesce(
        round(avg(
          case a.status
            when 'done' then 100
            when 'not_started' then 0
            else greatest(0, least(100, a.percent_complete))
          end
        ))::int, 0
      ) as pct
    from proj pr
    left join public.project_activities a on a.project_id = pr.id
    group by pr.id, pr.name, pr.slug, pr.status_override, pr.owner_user_id
  ),
  classified as (
    select
      a.*,
      case
        when total_acts > 0 and done_acts = total_acts then 'done'
        when status_override = 'blocked' then 'blocked'
        when overdue_acts > 0 or has_high_blocked then 'at_risk'
        when total_acts > done_acts then 'in_progress'
        else 'not_started'
      end as computed_status
    from agg a
  )
  select
    c.id          as project_id,
    c.name        as project_name,
    c.slug        as project_slug,
    c.computed_status,
    c.pct         as percent_complete,
    c.overdue_acts::int as overdue_count,
    c.blocked_acts::int as blocked_count,
    up.full_name  as owner_full_name,
    (
      (c.overdue_acts * 2)
      + (c.blocked_acts * 3)
      + (case when c.computed_status = 'at_risk' then 5 else 0 end)
      + (case when c.computed_status = 'blocked' then 8 else 0 end)
    )::int as score
  from classified c
  left join public.user_profiles up on up.id = c.owner_user_id
  where (
      (c.overdue_acts * 2)
      + (c.blocked_acts * 3)
      + (case when c.computed_status = 'at_risk' then 5 else 0 end)
      + (case when c.computed_status = 'blocked' then 8 else 0 end)
    ) > 0
  order by score desc, c.name asc
  limit greatest(p_limit, 0);
$$;

grant execute on function public.rpc_projects_requiring_attention(text, int) to authenticated;

-- ============================================
-- 4. RPC: rpc_delivery_trend(program_slug, timeframe)
-- ============================================
-- Returns activity completions bucketed by date. Bucket size depends on
-- timeframe: '30d' -> day, 'quarter' -> week, 'ytd' -> month.

create or replace function public.rpc_delivery_trend(
  p_program_slug text default null,
  p_timeframe    text default '30d'   -- '30d' | 'quarter' | 'ytd'
)
returns table (
  bucket_start date,
  bucket_label text,
  completed    bigint
)
language plpgsql
stable
security invoker
as $$
declare
  v_start date;
  v_unit  text;
  v_fmt   text;
begin
  if p_timeframe = 'quarter' then
    v_start := current_date - interval '90 days';
    v_unit  := 'week';
    v_fmt   := 'YYYY-"W"IW';
  elsif p_timeframe = 'ytd' then
    v_start := date_trunc('year', current_date)::date;
    v_unit  := 'month';
    v_fmt   := 'YYYY-MM';
  else
    -- default: last 30 days, daily
    v_start := current_date - interval '30 days';
    v_unit  := 'day';
    v_fmt   := 'YYYY-MM-DD';
  end if;

  return query
  with buckets as (
    select generate_series(
      date_trunc(v_unit, v_start)::date,
      date_trunc(v_unit, current_date)::date,
      ('1 ' || v_unit)::interval
    )::date as b
  ),
  done_acts as (
    select date_trunc(v_unit, a.completed_at)::date as b
      from public.project_activities a
      join public.projects p on p.id = a.project_id
     where a.completed_at is not null
       and a.completed_at >= v_start
       and (p_program_slug is null or p.program_slug = p_program_slug)
       and p.archived_at is null
  )
  select
    buckets.b                              as bucket_start,
    to_char(buckets.b, v_fmt)              as bucket_label,
    count(d.b)                             as completed
  from buckets
  left join done_acts d on d.b = buckets.b
  group by buckets.b
  order by buckets.b;
end;
$$;

grant execute on function public.rpc_delivery_trend(text, text) to authenticated;

-- ============================================
-- 5. RPC: rpc_workload_distribution(program_slug, limit)
-- ============================================
-- Returns top-N owners by open activity count, with overdue split out.

create or replace function public.rpc_workload_distribution(
  p_program_slug text default null,
  p_limit int default 10
)
returns table (
  owner_user_id   uuid,
  full_name       text,
  open_count      int,
  overdue_count   int
)
language sql
stable
security invoker
as $$
  select
    a.owner_user_id,
    coalesce(up.full_name, '(unassigned)') as full_name,
    count(*)::int                                                     as open_count,
    count(*) filter (
      where a.due_date is not null and a.due_date < current_date
    )::int                                                            as overdue_count
  from public.project_activities a
  join public.projects p on p.id = a.project_id
  left join public.user_profiles up on up.id = a.owner_user_id
  where a.status <> 'done'
    and p.archived_at is null
    and a.owner_user_id is not null
    and (p_program_slug is null or p.program_slug = p_program_slug)
  group by a.owner_user_id, up.full_name
  order by open_count desc, full_name asc
  limit greatest(p_limit, 0);
$$;

grant execute on function public.rpc_workload_distribution(text, int) to authenticated;
