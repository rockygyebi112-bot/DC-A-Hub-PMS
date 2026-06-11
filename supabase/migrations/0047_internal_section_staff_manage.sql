-- 0047_internal_section_staff_manage.sql
--
-- Sections (internal_areas) are now collaborative, Asana-style buckets rather
-- than a fixed admin-only taxonomy. Allow any staff OR admin to create, rename,
-- reorder and archive sections — previously these writes were admin-only.
--
-- Read access is unchanged (already staff+admin via internal_areas_read).
-- The application still guards deletes against non-empty sections in
-- `archiveArea`, so this does not let staff orphan tasks.

drop policy if exists internal_areas_admin_write on internal_areas;

create policy internal_areas_staff_write on internal_areas for all
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());
