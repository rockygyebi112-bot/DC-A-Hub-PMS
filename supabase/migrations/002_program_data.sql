-- ============================================
-- INDICATORS TABLE
-- ============================================
create table public.indicators (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  data_type text not null check (data_type in ('numeric', 'categorical')),
  options jsonb default '[]',
  is_core boolean not null default false,
  show_on_executive boolean not null default false,
  manual_entry boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================
-- ENTERPRISE SPOTLIGHT ENTRIES
-- ============================================
create table public.enterprise_spotlight_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id),
  applicant_name text not null default '',
  region text not null default '',
  gender text not null default '',
  age integer,
  age_bracket text not null default '',
  disability_status text not null default '',
  disability_type text,
  ownership_type text not null default '',
  business_longevity integer,
  business_size text not null default '',
  funding_status text not null default '',
  business_registered text not null default '',
  business_sector text not null default '',
  custom_fields jsonb default '{}',
  learning text default '',
  is_draft boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- VIRTUAL UNIVERSITY ENTRIES
-- ============================================
create table public.virtual_university_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id),
  episode_title text not null default '',
  date_aired date,
  platforms jsonb default '[]',
  metrics jsonb default '{}',
  demographics jsonb default '{}',
  custom_fields jsonb default '{}',
  learning text default '',
  is_draft boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- HANGOUT ENTRIES
-- ============================================
create table public.hangout_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id),
  episode_title text not null default '',
  date_aired date,
  platforms jsonb default '[]',
  metrics jsonb default '{}',
  demographics jsonb default '{}',
  custom_fields jsonb default '{}',
  learning text default '',
  is_draft boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- ABSA ONBOARDING ENTRIES
-- ============================================
create table public.absa_onboarding_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id),
  participant_name text not null default '',
  gender text not null default '',
  age integer,
  age_bracket text not null default '',
  region text not null default '',
  employment_status text not null default '',
  disability_status text not null default '',
  custom_fields jsonb default '{}',
  learning text default '',
  is_draft boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- LEARNINGS TABLE
-- ============================================
create table public.learnings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id),
  program_id uuid not null references public.programs(id),
  category text not null default '',
  title text not null default '',
  description text default '',
  learning_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- ROW LEVEL SECURITY — ENTRY TABLES
-- ============================================

-- Helper: check if user has data_entry permission
create or replace function public.has_data_entry_access(uid uuid)
returns boolean as $$
  select exists (
    select 1
    from public.user_profiles up
    join public.role_permissions rp on rp.role_id = up.role_id
    where up.id = uid
      and up.status = 'active'
      and rp.module = 'data_entry'
      and rp.allowed = true
  );
$$ language sql security definer stable;

-- Helper: check if user is admin
create or replace function public.is_admin(uid uuid)
returns boolean as $$
  select exists (
    select 1
    from public.user_profiles up
    join public.roles r on up.role_id = r.id
    where up.id = uid and r.name = 'Admin'
  );
$$ language sql security definer stable;

-- Enterprise Spotlight RLS
alter table public.enterprise_spotlight_entries enable row level security;

create policy "Data entry users can insert ES entries"
  on public.enterprise_spotlight_entries for insert
  with check (public.has_data_entry_access(auth.uid()));

create policy "Users can view own ES entries"
  on public.enterprise_spotlight_entries for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Users can update own ES entries"
  on public.enterprise_spotlight_entries for update
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Users can delete own ES entries"
  on public.enterprise_spotlight_entries for delete
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Virtual University RLS
alter table public.virtual_university_entries enable row level security;

create policy "Data entry users can insert VU entries"
  on public.virtual_university_entries for insert
  with check (public.has_data_entry_access(auth.uid()));

create policy "Users can view own VU entries"
  on public.virtual_university_entries for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Users can update own VU entries"
  on public.virtual_university_entries for update
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Users can delete own VU entries"
  on public.virtual_university_entries for delete
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Hangout RLS
alter table public.hangout_entries enable row level security;

create policy "Data entry users can insert Hangout entries"
  on public.hangout_entries for insert
  with check (public.has_data_entry_access(auth.uid()));

create policy "Users can view own Hangout entries"
  on public.hangout_entries for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Users can update own Hangout entries"
  on public.hangout_entries for update
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Users can delete own Hangout entries"
  on public.hangout_entries for delete
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ABSA Onboarding RLS
alter table public.absa_onboarding_entries enable row level security;

create policy "Data entry users can insert ABSA entries"
  on public.absa_onboarding_entries for insert
  with check (public.has_data_entry_access(auth.uid()));

create policy "Users can view own ABSA entries"
  on public.absa_onboarding_entries for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Users can update own ABSA entries"
  on public.absa_onboarding_entries for update
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Users can delete own ABSA entries"
  on public.absa_onboarding_entries for delete
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Learnings RLS
alter table public.learnings enable row level security;

create policy "Data entry users can insert learnings"
  on public.learnings for insert
  with check (public.has_data_entry_access(auth.uid()));

create policy "Authenticated users can view learnings"
  on public.learnings for select
  using (auth.role() = 'authenticated');

create policy "Users can update own learnings"
  on public.learnings for update
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Users can delete own learnings"
  on public.learnings for delete
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Indicators RLS
alter table public.indicators enable row level security;

create policy "Authenticated users can view active indicators"
  on public.indicators for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage indicators"
  on public.indicators for all
  using (public.is_admin(auth.uid()));

-- ============================================
-- SEED CORE INDICATORS
-- ============================================

-- Enterprise Spotlight core indicators
insert into public.indicators (program_id, name, data_type, options, is_core, show_on_executive, sort_order)
select p.id, i.name, i.data_type, i.options::jsonb, true, i.show_on_ed, i.sort_order
from public.programs p,
(values
  ('Total Applications', 'numeric', '[]', true, 1),
  ('Region', 'categorical', '["Gauteng","Western Cape","KwaZulu-Natal","Eastern Cape","Free State","Limpopo","Mpumalanga","North West","Northern Cape"]', true, 2),
  ('Gender', 'categorical', '["Male","Female","Non-binary","Prefer not to say"]', true, 3),
  ('Age Bracket', 'categorical', '["Under 18","18-24","25-34","35-44","45-54","55-64","65+"]', true, 4),
  ('Disability Status', 'categorical', '["Yes","No"]', true, 5),
  ('Ownership Type', 'categorical', '["Sole Proprietor","Partnership","Close Corporation","(Pty) Ltd","Cooperative","Other"]', false, 6),
  ('Business Longevity', 'numeric', '[]', false, 7),
  ('Business Size', 'categorical', '["Micro (0-10)","Small (11-50)","Medium (51-200)","Large (200+)"]', false, 8),
  ('Funding Status', 'categorical', '["Self-funded","Grant-funded","Loan-funded","Investor-funded","Mixed"]', false, 9),
  ('Registration Status', 'categorical', '["Yes","No"]', false, 10),
  ('Business Sector', 'categorical', '["Agriculture","Construction","Education","Finance","Healthcare","Hospitality","ICT","Manufacturing","Mining","Retail","Services","Transport","Other"]', false, 11)
) as i(name, data_type, options, show_on_ed, sort_order)
where p.slug = 'enterprise-spotlight';

-- Virtual University core indicators
insert into public.indicators (program_id, name, data_type, options, is_core, show_on_executive, sort_order)
select p.id, i.name, i.data_type, i.options::jsonb, true, i.show_on_ed, i.sort_order
from public.programs p,
(values
  ('Total Episodes', 'numeric', '[]', true, 1),
  ('Total Views', 'numeric', '[]', true, 2),
  ('Views per Platform', 'categorical', '["Facebook","YouTube"]', true, 3),
  ('Shares/Saves', 'numeric', '[]', false, 4),
  ('Likes', 'numeric', '[]', false, 5),
  ('Gender', 'categorical', '["Male","Female","Non-binary","Prefer not to say"]', true, 6),
  ('Age Bracket', 'categorical', '["Under 18","18-24","25-34","35-44","45-54","55-64","65+"]', true, 7)
) as i(name, data_type, options, show_on_ed, sort_order)
where p.slug = 'virtual-university';

-- Hangout core indicators (same as VU)
insert into public.indicators (program_id, name, data_type, options, is_core, show_on_executive, sort_order)
select p.id, i.name, i.data_type, i.options::jsonb, true, i.show_on_ed, i.sort_order
from public.programs p,
(values
  ('Total Episodes', 'numeric', '[]', true, 1),
  ('Total Views', 'numeric', '[]', true, 2),
  ('Views per Platform', 'categorical', '["Facebook","YouTube"]', true, 3),
  ('Shares/Saves', 'numeric', '[]', false, 4),
  ('Likes', 'numeric', '[]', false, 5),
  ('Gender', 'categorical', '["Male","Female","Non-binary","Prefer not to say"]', true, 6),
  ('Age Bracket', 'categorical', '["Under 18","18-24","25-34","35-44","45-54","55-64","65+"]', true, 7)
) as i(name, data_type, options, show_on_ed, sort_order)
where p.slug = 'hangout';

-- ABSA Onboarding core indicators
insert into public.indicators (program_id, name, data_type, options, is_core, show_on_executive, sort_order)
select p.id, i.name, i.data_type, i.options::jsonb, true, i.show_on_ed, i.sort_order
from public.programs p,
(values
  ('Total Participants', 'numeric', '[]', true, 1),
  ('Gender', 'categorical', '["Male","Female","Non-binary","Prefer not to say"]', true, 2),
  ('Age Bracket', 'categorical', '["Under 18","18-24","25-34","35-44","45-54","55-64","65+"]', true, 3),
  ('Region', 'categorical', '["Gauteng","Western Cape","KwaZulu-Natal","Eastern Cape","Free State","Limpopo","Mpumalanga","North West","Northern Cape"]', true, 4),
  ('Employment Status', 'categorical', '["Employed","Unemployed","Self-employed","Student","Other"]', false, 5),
  ('Disability Status', 'categorical', '["Yes","No"]', true, 6)
) as i(name, data_type, options, show_on_ed, sort_order)
where p.slug = 'absa-onboarding';

-- ============================================
-- INDEXES
-- ============================================
create index idx_es_entries_user on public.enterprise_spotlight_entries(user_id);
create index idx_es_entries_created on public.enterprise_spotlight_entries(created_at desc);
create index idx_vu_entries_user on public.virtual_university_entries(user_id);
create index idx_vu_entries_created on public.virtual_university_entries(created_at desc);
create index idx_hangout_entries_user on public.hangout_entries(user_id);
create index idx_hangout_entries_created on public.hangout_entries(created_at desc);
create index idx_absa_entries_user on public.absa_onboarding_entries(user_id);
create index idx_absa_entries_created on public.absa_onboarding_entries(created_at desc);
create index idx_learnings_user on public.learnings(user_id);
create index idx_learnings_program on public.learnings(program_id);
create index idx_learnings_created on public.learnings(created_at desc);
create index idx_indicators_program on public.indicators(program_id);
create index idx_indicators_active on public.indicators(is_active);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_es_updated_at before update on public.enterprise_spotlight_entries
  for each row execute function public.set_updated_at();
create trigger set_vu_updated_at before update on public.virtual_university_entries
  for each row execute function public.set_updated_at();
create trigger set_hangout_updated_at before update on public.hangout_entries
  for each row execute function public.set_updated_at();
create trigger set_absa_updated_at before update on public.absa_onboarding_entries
  for each row execute function public.set_updated_at();
create trigger set_learnings_updated_at before update on public.learnings
  for each row execute function public.set_updated_at();
