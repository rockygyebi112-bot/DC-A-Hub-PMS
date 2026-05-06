-- supabase/migrations/008_nkabom_program_slug.sql
-- Backfill Nkabom Collaborative's program_slug so Delivery Dashboard
-- filters return its project rows.

update public.projects
   set program_slug = 'nkabom-collaborative'
 where slug = 'nkabom-collaborative'
   and program_slug is null;
