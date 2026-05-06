-- supabase/migrations/005a_projects_enum.sql
--
-- Postgres requires new enum values to be committed before they can be used.
-- This file must run BEFORE 005_projects.sql (which references 'projects' in
-- app_module casts). Running the ALTER TYPE in its own transaction satisfies
-- the "committed before use" rule.

alter type public.app_module add value if not exists 'projects';
