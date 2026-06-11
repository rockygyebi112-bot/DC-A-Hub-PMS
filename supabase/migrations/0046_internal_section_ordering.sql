-- 0046_internal_section_ordering.sql
--
-- Internal "areas" are now surfaced as user-managed, Asana-style SECTIONS.
-- Add an explicit ordering column so the workspace can drag-reorder sections
-- instead of falling back to alphabetical order.
--
-- `position` is a float so a future midpoint-insert reorder stays cheap; the
-- app currently renumbers in steps of 1000 on every reorder, which is simplest
-- and avoids precision drift for the small number of sections involved.

alter table internal_areas
  add column if not exists position double precision;

-- Backfill existing sections with sequential positions in their current
-- (alphabetical) order so nothing jumps around on first load.
with ranked as (
  select id, row_number() over (order by name) * 1000.0 as pos
  from internal_areas
)
update internal_areas a
set position = ranked.pos
from ranked
where a.id = ranked.id
  and a.position is null;

-- New sections created without an explicit position sort to the end.
alter table internal_areas
  alter column position set default 1000000;

create index if not exists internal_areas_position_idx
  on internal_areas (position);
