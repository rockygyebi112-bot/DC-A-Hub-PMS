-- 0028 Hot-path indexes
--
-- Adds composite/single-column indexes for the columns most often used in
-- WHERE/ORDER BY across dashboard, portal, and workplan queries. Each is
-- created with IF NOT EXISTS so the migration is idempotent and CONCURRENTLY
-- (where Supabase allows) so it doesn't take a heavy lock on production.

-- Dashboard "overdue" + workplan ordering both filter / sort by planned_date.
create index if not exists activities_planned_date_idx
  on activities(planned_date);

-- Recent completions for dashboards + portal announcements.
create index if not exists activities_completed_date_idx
  on activities(completed_date);

-- Portal announcements + admin activity feed both:
--   eq(project_id, ?) AND order by created_at desc.
-- A composite covers both ends in one index scan.
create index if not exists activity_log_project_created_idx
  on activity_log(project_id, created_at desc);

-- Portal announcements filter by action ('marked_done', 'proof_added', ...)
-- before scanning. Indexing the discriminator gives the planner a cheap
-- bitmap to combine with the project filter above.
create index if not exists activity_log_action_idx
  on activity_log(action);

-- Portal key-documents lists proofs newest-first across many activities.
create index if not exists activity_proofs_created_at_idx
  on activity_proofs(created_at desc);

-- Admin dashboard scopes everything to a rolling period via
-- gte(created_at, periodStart). On the projects table this filter is
-- applied to every row, so an index pays for itself quickly.
create index if not exists projects_created_at_idx
  on projects(created_at);
