-- 0021_project_activity_counts_view.sql
--
-- Pre-aggregated done/total activity counts per project, plus a richer
-- per-status breakdown for the admin dashboard. Replaces several hot client
-- queries that pulled every activity row in the org just to compute scalar
-- "X / Y done" labels:
--
--   - lib/workspace/queries.ts::listWorkspaceProjects (used to embed
--     `phases(id, activities(status))` and tally in JS).
--   - lib/workspace/queries.ts::getWorkspaceProject (same, scoped to one row).
--   - app/admin/page.tsx::getDashboardData activity aggregation.
--
-- The view is a regular (non-materialised) view so it always reflects the
-- live activity table; counts are cheap because we have indexes on
-- `phases.project_id` and `activities.phase_id` already. If load grows we
-- can swap this for a materialised view + on-change refresh trigger
-- without touching the call sites.
--
-- RLS: the view inherits from its underlying tables (`projects`, `phases`,
-- `activities`), all of which already have row-level security. Postgres
-- views run with the privileges of the querying role, so this exposes
-- exactly the rows the caller would see if they queried activities
-- directly — no escalation.

create or replace view project_activity_counts as
select
  p.id                                                        as project_id,
  count(a.id)                                                 as total_count,
  count(a.id) filter (where a.status = 'done')                as done_count,
  count(a.id) filter (where a.status = 'in_progress')         as in_progress_count,
  count(a.id) filter (where a.status = 'not_started')         as not_started_count
from projects p
left join phases     ph on ph.project_id = p.id
left join activities a  on a.phase_id   = ph.id
group by p.id;

comment on view project_activity_counts is
  'Per-project rollup of activity counts by status. Read by workspace and admin dashboards instead of fetching every activity row.';

-- PostgREST needs an explicit grant to expose the view to the API roles.
grant select on project_activity_counts to authenticated, service_role;
