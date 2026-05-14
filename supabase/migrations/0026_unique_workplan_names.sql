-- 0026_unique_workplan_names.sql
--
-- Addresses M-3: the XLSX workplan import path performs phase- and
-- activity-name lookups followed by inserts. Without a uniqueness guard at
-- the row level, two concurrent imports (or the same import retried) can
-- produce duplicate phases/activities under the same parent — which then
-- silently corrupts the workplan tree.
--
-- The constraint is per-parent so different projects can still legitimately
-- reuse the same phase name, and different phases can reuse activity names.
--
-- If existing data contains duplicates these statements will fail; the
-- operator must dedupe (merge or rename) before applying the migration.

alter table phases
  add constraint phases_project_name_unique
  unique (project_id, name);

alter table activities
  add constraint activities_phase_name_unique
  unique (phase_id, name);
