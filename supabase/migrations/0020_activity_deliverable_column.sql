-- 0020_activity_deliverable_column.sql
--
-- Promote "Deliverable" out of the legacy description blob into its own
-- column. Historically the workplan importer concatenated multiple fields
-- (Deliverable, Notes/Dependencies, Responsible) into `activities.description`
-- so the activity edit form could only show them as a single textarea. The
-- UI now exposes Deliverable + Responsible as their own inputs, so we need
-- a real column to back them and a one-time backfill for legacy rows.

alter table activities add column if not exists deliverable text;

-- Backfill `deliverable` from the first "Deliverable: ..." line embedded in
-- the description blob, but only when the new column is still empty.
update activities a
set deliverable = btrim(parsed.match[1])
from (
  select id, regexp_match(description, 'Deliverable:\s*([^\n]*)') as match
  from activities
  where description ~ 'Deliverable:'
) as parsed
where a.id = parsed.id
  and parsed.match is not null
  and (a.deliverable is null or a.deliverable = '');

-- Backfill `responsible` from the embedded "Responsible: ..." line when the
-- dedicated column hasn't been populated yet (older sheets dumped it into
-- description before the column was added).
update activities a
set responsible = btrim(parsed.match[1])
from (
  select id, regexp_match(description, 'Responsible:\s*([^\n]*)') as match
  from activities
  where description ~ 'Responsible:'
) as parsed
where a.id = parsed.id
  and parsed.match is not null
  and (a.responsible is null or a.responsible = '');

-- Strip the parsed Deliverable/Responsible lines and the "Notes/Dependencies:"
-- prefix from the description so what's left is plain notes text. Rows that
-- never used the legacy blob format are untouched.
update activities
set description = nullif(
  btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(description, ''), '(^|\n)\s*Deliverable:[^\n]*', '', 'g'),
        '(^|\n)\s*Responsible:[^\n]*', '', 'g'
      ),
      '(^|\n)\s*Notes/Dependencies:\s*', E'\\1', 'g'
    )
  ),
  ''
)
where description ~ '(Deliverable:|Responsible:|Notes/Dependencies:)';
