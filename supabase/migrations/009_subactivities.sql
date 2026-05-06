-- supabase/migrations/009_subactivities.sql
-- Sub-activities: one level of nesting under project_activities.

alter table public.project_activities
  add column if not exists parent_activity_id uuid
    references public.project_activities(id) on delete cascade;

create index if not exists idx_project_activities_parent
  on public.project_activities(parent_activity_id);

-- Enforce 1-level nesting: a sub-activity cannot itself become a parent.
create or replace function public.enforce_subactivity_depth()
returns trigger
language plpgsql
as $$
declare
  parent_has_parent boolean;
begin
  if new.parent_activity_id is null then
    return new;
  end if;

  -- Reject self-parent
  if new.parent_activity_id = new.id then
    raise exception 'Activity cannot be its own parent';
  end if;

  -- The chosen parent must itself be a top-level activity
  select (parent_activity_id is not null)
    into parent_has_parent
    from public.project_activities
   where id = new.parent_activity_id;

  if parent_has_parent then
    raise exception 'Sub-activities cannot have sub-activities (max 1 level of nesting)';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_subactivity_depth on public.project_activities;
create trigger trg_enforce_subactivity_depth
before insert or update of parent_activity_id on public.project_activities
for each row execute function public.enforce_subactivity_depth();
