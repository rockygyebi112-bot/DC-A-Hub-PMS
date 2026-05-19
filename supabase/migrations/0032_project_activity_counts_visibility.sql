-- 0032_project_activity_counts_visibility.sql
--
-- Extends the rollup view with client-facing counts alongside the
-- existing overall counts. Staff/admin pages render both; the portal
-- renders only client_* columns. No changes to RLS — the view runs as
-- the caller, so a viewer querying *_total_count still gets only rows
-- they're allowed to see (i.e. client_visible), making both pairs
-- consistent for that role.

create or replace view project_activity_counts as
select
  p.id                                                              as project_id,
  count(a.id)                                                       as total_count,
  count(a.id) filter (where a.status = 'done')                      as done_count,
  count(a.id) filter (where a.status = 'in_progress')               as in_progress_count,
  count(a.id) filter (where a.status = 'not_started')               as not_started_count,
  count(a.id) filter (where a.visibility = 'client_visible')        as client_total_count,
  count(a.id) filter (where a.visibility = 'client_visible'
                        and a.status   = 'done')                    as client_done_count,
  count(a.id) filter (where a.visibility = 'client_visible'
                        and a.status   = 'in_progress')             as client_in_progress_count,
  count(a.id) filter (where a.visibility = 'client_visible'
                        and a.status   = 'not_started')             as client_not_started_count
from projects p
left join phases     ph on ph.project_id = p.id
left join activities a  on a.phase_id   = ph.id
group by p.id;

-- Preserve security_invoker behaviour from 0023; `create or replace view`
-- resets view options, so re-apply it here.
alter view public.project_activity_counts set (security_invoker = true);

grant select on project_activity_counts to authenticated, service_role;

comment on view project_activity_counts is
  'Per-project activity counts: total_* (all visibility) and client_* (client_visible only).';
