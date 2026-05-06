-- supabase/migrations/010_project_milestone_details.sql
-- Add optional milestone metadata for richer planning and portfolio views.

alter table public.project_milestones
  add column if not exists description text,
  add column if not exists target_date date;
