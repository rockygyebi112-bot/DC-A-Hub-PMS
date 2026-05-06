-- ============================================
-- Migration 003: Ghana localization + Disability type for ABSA
-- ============================================
--
-- 1. Add disability_type column to absa_onboarding_entries
-- 2. Replace seeded Region indicators with the 16 Ghana regions
-- 3. Simplify Gender indicators to Male/Female only
-- 4. Add a Disability Type indicator (with "Other" for custom input)
--    to programs that collect Disability Status
--
-- Safe to re-run: uses IF NOT EXISTS / conditional upserts where
-- possible, but the category-value updates are unconditional.

-- --------------------------------------------------------------
-- 1. ABSA table: add disability_type column
-- --------------------------------------------------------------
alter table public.absa_onboarding_entries
  add column if not exists disability_type text;

-- --------------------------------------------------------------
-- 2. Replace Region options across all programs (Ghana regions)
-- --------------------------------------------------------------
update public.indicators
set options = '["Ahafo","Ashanti","Bono","Bono East","Central","Eastern","Greater Accra","North East","Northern","Oti","Savannah","Upper East","Upper West","Volta","Western","Western North"]'::jsonb
where name = 'Region'
  and data_type = 'categorical';

-- --------------------------------------------------------------
-- 3. Simplify Gender options to Male / Female across programs
-- --------------------------------------------------------------
update public.indicators
set options = '["Male","Female"]'::jsonb
where name = 'Gender'
  and data_type = 'categorical';

-- --------------------------------------------------------------
-- 4. Seed "Disability Type" core indicator for programs that track
--    Disability Status but don't yet have a Disability Type indicator.
--    Programs: enterprise-spotlight, absa-onboarding.
-- --------------------------------------------------------------
insert into public.indicators
  (program_id, name, data_type, options, is_core, show_on_executive, sort_order)
select
  p.id,
  'Disability Type',
  'categorical',
  '["Visual","Hearing","Physical","Intellectual","Speech","Psychosocial","Other"]'::jsonb,
  true,
  false,
  -- Place it right after Disability Status in each program
  coalesce(
    (select sort_order + 1
       from public.indicators i2
      where i2.program_id = p.id
        and i2.name = 'Disability Status'
      limit 1),
    99
  )
from public.programs p
where p.slug in ('enterprise-spotlight', 'absa-onboarding')
  and not exists (
    select 1 from public.indicators i
    where i.program_id = p.id and i.name = 'Disability Type'
  );
