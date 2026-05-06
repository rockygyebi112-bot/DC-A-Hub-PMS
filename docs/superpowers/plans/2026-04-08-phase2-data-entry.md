# Phase 2: Database Schema + Data Entry Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the program data tables and indicators table in Supabase, then build the Data Entry module with program-specific forms, save-as-draft, and recent entries management.

**Architecture:** Each program has its own Postgres table (JSONB columns for flexible data). The Data Entry page uses a card-based program selector that renders program-specific form components. Forms share a common shell for validation, submit, and draft logic. Virtual University and Hangout share a single form component (DRY). The browser Supabase client handles all CRUD directly (RLS enforces permissions — no API routes needed). An indicators table is created and seeded with core indicators to support future dynamic form fields (Phase 5).

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (base-ui, NOT Radix), Supabase (PostgreSQL + RLS), Sonner (toasts), xlsx (future bulk upload)

**Project directory:** `C:\Users\ishma\Desktop\springboard-mis`

---

## File Structure

```
springboard-mis/
├── supabase/
│   └── migrations/
│       └── 002_program_data.sql              # Program entry tables + indicators + RLS
├── src/
│   ├── lib/
│   │   ├── types.ts                          # MODIFY: Add entry types, indicator type
│   │   ├── constants.ts                      # MODIFY: Add form option constants
│   │   └── utils.ts                          # MODIFY: Add getAgeBracket utility
│   ├── components/
│   │   └── data-entry/
│   │       ├── program-selector.tsx           # Card-based program picker (5 cards)
│   │       ├── enterprise-spotlight-form.tsx   # 13-field form for ES program
│   │       ├── media-program-form.tsx         # Shared form for VU + Hangout
│   │       ├── absa-onboarding-form.tsx       # 6-field form for ABSA
│   │       ├── learnings-form.tsx             # Learnings entry form
│   │       └── recent-entries-table.tsx       # Last 10 entries with edit/delete
│   └── app/
│       └── (dashboard)/
│           └── data-entry/
│               └── page.tsx                   # MODIFY: Program selector → form → recent entries
```

---

### Task 1: Database Migration — Program Entry Tables + Indicators

**Files:**
- Create: `supabase/migrations/002_program_data.sql`

This SQL must be run manually in the Supabase SQL Editor (same as 001_foundation.sql).

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/002_program_data.sql`:

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/002_program_data.sql
git commit -m "feat: add database migration for program entry tables, indicators, and RLS"
```

**Note to implementer:** After committing, run this SQL in the Supabase SQL Editor manually.

---

### Task 2: TypeScript Types for New Tables

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add entry and indicator types to types.ts**

Append the following types to `src/lib/types.ts` (after the existing `Program` interface):

```typescript
// ============================================
// INDICATORS
// ============================================

export interface Indicator {
  id: string;
  program_id: string;
  name: string;
  data_type: "numeric" | "categorical";
  options: string[];
  is_core: boolean;
  show_on_executive: boolean;
  manual_entry: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// ============================================
// PROGRAM ENTRIES
// ============================================

export interface EnterpriseSpotlightEntry {
  id: string;
  user_id: string;
  applicant_name: string;
  region: string;
  gender: string;
  age: number | null;
  age_bracket: string;
  disability_status: string;
  disability_type: string | null;
  ownership_type: string;
  business_longevity: number | null;
  business_size: string;
  funding_status: string;
  business_registered: string;
  business_sector: string;
  custom_fields: Record<string, unknown>;
  learning: string;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export interface MediaProgramEntry {
  id: string;
  user_id: string;
  episode_title: string;
  date_aired: string | null;
  platforms: string[];
  metrics: {
    facebook?: { views: number; shares: number; saves: number; likes: number };
    youtube?: { views: number; shares: number; saves: number; likes: number };
  };
  demographics: {
    gender: Record<string, number>;
    age_brackets: Record<string, number>;
  };
  custom_fields: Record<string, unknown>;
  learning: string;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export interface AbsaOnboardingEntry {
  id: string;
  user_id: string;
  participant_name: string;
  gender: string;
  age: number | null;
  age_bracket: string;
  region: string;
  employment_status: string;
  disability_status: string;
  custom_fields: Record<string, unknown>;
  learning: string;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export interface LearningEntry {
  id: string;
  user_id: string;
  program_id: string;
  category: string;
  title: string;
  description: string;
  learning_date: string | null;
  created_at: string;
  updated_at: string;
  program?: Program;
}

// Union type for any entry across programs
export type ProgramEntry =
  | EnterpriseSpotlightEntry
  | MediaProgramEntry
  | AbsaOnboardingEntry
  | LearningEntry;

// Slug to table name mapping
export type ProgramSlug =
  | "enterprise-spotlight"
  | "virtual-university"
  | "hangout"
  | "absa-onboarding"
  | "learnings";

export const PROGRAM_TABLE_MAP: Record<ProgramSlug, string> = {
  "enterprise-spotlight": "enterprise_spotlight_entries",
  "virtual-university": "virtual_university_entries",
  "hangout": "hangout_entries",
  "absa-onboarding": "absa_onboarding_entries",
  "learnings": "learnings",
};
```

- [ ] **Step 2: Verify build**

Run: `npx next build` (or `npm run build`)
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add TypeScript types for program entries and indicators"
```

---

### Task 3: Form Option Constants + Age Bracket Utility

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/utils.ts`

- [ ] **Step 1: Add form option constants to constants.ts**

Append the following to `src/lib/constants.ts` (after the existing `MODULE_LABELS` export):

```typescript
// ============================================
// DATA ENTRY FORM OPTIONS
// ============================================

export const REGIONS = [
  "Gauteng",
  "Western Cape",
  "KwaZulu-Natal",
  "Eastern Cape",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
] as const;

export const GENDERS = [
  "Male",
  "Female",
  "Non-binary",
  "Prefer not to say",
] as const;

export const DISABILITY_TYPES = [
  "Visual",
  "Hearing",
  "Physical",
  "Intellectual",
  "Other",
] as const;

export const OWNERSHIP_TYPES = [
  "Sole Proprietor",
  "Partnership",
  "Close Corporation",
  "(Pty) Ltd",
  "Cooperative",
  "Other",
] as const;

export const BUSINESS_SIZES = [
  "Micro (0-10)",
  "Small (11-50)",
  "Medium (51-200)",
  "Large (200+)",
] as const;

export const FUNDING_STATUSES = [
  "Self-funded",
  "Grant-funded",
  "Loan-funded",
  "Investor-funded",
  "Mixed",
] as const;

export const BUSINESS_SECTORS = [
  "Agriculture",
  "Construction",
  "Education",
  "Finance",
  "Healthcare",
  "Hospitality",
  "ICT",
  "Manufacturing",
  "Mining",
  "Retail",
  "Services",
  "Transport",
  "Other",
] as const;

export const EMPLOYMENT_STATUSES = [
  "Employed",
  "Unemployed",
  "Self-employed",
  "Student",
  "Other",
] as const;

export const PLATFORMS = ["Facebook", "YouTube"] as const;

export const AGE_BRACKETS = [
  "Under 18",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
] as const;

export const LEARNING_CATEGORIES = [
  "Operations",
  "Partnerships",
  "Audience Engagement",
  "Impact",
  "Other",
] as const;

// Programs available in data entry (includes Learnings as a data entry option)
export const DATA_ENTRY_PROGRAMS = [
  { name: "Enterprise Spotlight", slug: "enterprise-spotlight", description: "Track enterprise development applications and business metrics" },
  { name: "Virtual University", slug: "virtual-university", description: "Record weekly educational episode data and audience metrics" },
  { name: "Hangout", slug: "hangout", description: "Record weekly community engagement episode data" },
  { name: "ABSA Onboarding", slug: "absa-onboarding", description: "Track participant onboarding for the ABSA partnership" },
  { name: "Learnings", slug: "learnings", description: "Capture learnings and insights across all programs" },
] as const;
```

- [ ] **Step 2: Add getAgeBracket utility to utils.ts**

Add the following function to `src/lib/utils.ts` (after the existing `cn` function):

```typescript
export function getAgeBracket(age: number): string {
  if (age < 18) return "Under 18";
  if (age <= 24) return "18-24";
  if (age <= 34) return "25-34";
  if (age <= 44) return "35-44";
  if (age <= 54) return "45-54";
  if (age <= 64) return "55-64";
  return "65+";
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/utils.ts
git commit -m "feat: add form option constants and age bracket utility"
```

---

### Task 4: Program Selector Component

**Files:**
- Create: `src/components/data-entry/program-selector.tsx`

- [ ] **Step 1: Create the program selector component**

Create `src/components/data-entry/program-selector.tsx`:

```tsx
"use client";

import { DATA_ENTRY_PROGRAMS } from "@/lib/constants";
import { ProgramSlug } from "@/lib/types";
import {
  Briefcase,
  MonitorPlay,
  Users,
  Landmark,
  Lightbulb,
  LucideIcon,
} from "lucide-react";

const PROGRAM_ICONS: Record<string, LucideIcon> = {
  "enterprise-spotlight": Briefcase,
  "virtual-university": MonitorPlay,
  "hangout": Users,
  "absa-onboarding": Landmark,
  "learnings": Lightbulb,
};

interface ProgramSelectorProps {
  onSelect: (slug: ProgramSlug) => void;
}

export function ProgramSelector({ onSelect }: ProgramSelectorProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Select a Program</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DATA_ENTRY_PROGRAMS.map((program) => {
          const Icon = PROGRAM_ICONS[program.slug];
          return (
            <button
              key={program.slug}
              onClick={() => onSelect(program.slug as ProgramSlug)}
              className="flex flex-col items-start gap-2 rounded-lg border bg-card p-5 text-left transition-colors hover:border-srsf-green-500 hover:bg-srsf-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-srsf-green-500"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-srsf-green-100 p-2 text-srsf-green-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{program.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {program.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/data-entry/program-selector.tsx
git commit -m "feat: add program selector card component for data entry"
```

---

### Task 5: Enterprise Spotlight Form

**Files:**
- Create: `src/components/data-entry/enterprise-spotlight-form.tsx`

- [ ] **Step 1: Create the Enterprise Spotlight form component**

Create `src/components/data-entry/enterprise-spotlight-form.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { EnterpriseSpotlightEntry } from "@/lib/types";
import { getAgeBracket } from "@/lib/utils";
import {
  REGIONS,
  GENDERS,
  DISABILITY_TYPES,
  OWNERSHIP_TYPES,
  BUSINESS_SIZES,
  FUNDING_STATUSES,
  BUSINESS_SECTORS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";

interface EnterpriseSpotlightFormProps {
  editEntry?: EnterpriseSpotlightEntry | null;
  onSaved: () => void;
  onCancel?: () => void;
}

const EMPTY_FORM = {
  applicant_name: "",
  region: "",
  gender: "",
  age: "",
  disability_status: "",
  disability_type: "",
  ownership_type: "",
  business_longevity: "",
  business_size: "",
  funding_status: "",
  business_registered: "",
  business_sector: "",
  learning: "",
};

export function EnterpriseSpotlightForm({
  editEntry,
  onSaved,
  onCancel,
}: EnterpriseSpotlightFormProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (editEntry) {
      setForm({
        applicant_name: editEntry.applicant_name,
        region: editEntry.region,
        gender: editEntry.gender,
        age: editEntry.age?.toString() ?? "",
        disability_status: editEntry.disability_status,
        disability_type: editEntry.disability_type ?? "",
        ownership_type: editEntry.ownership_type,
        business_longevity: editEntry.business_longevity?.toString() ?? "",
        business_size: editEntry.business_size,
        funding_status: editEntry.funding_status,
        business_registered: editEntry.business_registered,
        business_sector: editEntry.business_sector,
        learning: editEntry.learning,
      });
    }
  }, [editEntry]);

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(isDraft: boolean) {
    if (!isDraft && !form.applicant_name.trim()) {
      toast.error("Applicant name is required");
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      setSaving(false);
      return;
    }

    const ageNum = form.age ? parseInt(form.age, 10) : null;
    const record = {
      user_id: user.id,
      applicant_name: form.applicant_name,
      region: form.region,
      gender: form.gender,
      age: ageNum,
      age_bracket: ageNum ? getAgeBracket(ageNum) : "",
      disability_status: form.disability_status,
      disability_type:
        form.disability_status === "Yes" ? form.disability_type : null,
      ownership_type: form.ownership_type,
      business_longevity: form.business_longevity
        ? parseInt(form.business_longevity, 10)
        : null,
      business_size: form.business_size,
      funding_status: form.funding_status,
      business_registered: form.business_registered,
      business_sector: form.business_sector,
      learning: form.learning,
      is_draft: isDraft,
    };

    let error;
    if (editEntry) {
      ({ error } = await supabase
        .from("enterprise_spotlight_entries")
        .update(record)
        .eq("id", editEntry.id));
    } else {
      ({ error } = await supabase
        .from("enterprise_spotlight_entries")
        .insert(record));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      isDraft
        ? "Draft saved"
        : editEntry
          ? "Entry updated"
          : "Entry submitted"
    );
    setForm(EMPTY_FORM);
    onSaved();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Applicant Name */}
        <div className="space-y-2">
          <Label htmlFor="applicant_name">Applicant Name *</Label>
          <Input
            id="applicant_name"
            value={form.applicant_name}
            onChange={(e) => setField("applicant_name", e.target.value)}
            placeholder="Full name"
          />
        </div>

        {/* Region */}
        <div className="space-y-2">
          <Label htmlFor="region">Region</Label>
          <Select
            value={form.region}
            onValueChange={(v) => setField("region", v)}
          >
            <SelectTrigger id="region">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select
            value={form.gender}
            onValueChange={(v) => setField("gender", v)}
          >
            <SelectTrigger id="gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              {GENDERS.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Age */}
        <div className="space-y-2">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            type="number"
            min={0}
            max={150}
            value={form.age}
            onChange={(e) => setField("age", e.target.value)}
            placeholder="Age in years"
          />
          {form.age && (
            <p className="text-xs text-muted-foreground">
              Bracket: {getAgeBracket(parseInt(form.age, 10))}
            </p>
          )}
        </div>

        {/* Disability Status */}
        <div className="space-y-2">
          <Label htmlFor="disability_status">Disability Status</Label>
          <Select
            value={form.disability_status}
            onValueChange={(v) => setField("disability_status", v)}
          >
            <SelectTrigger id="disability_status">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Disability Type (conditional) */}
        {form.disability_status === "Yes" && (
          <div className="space-y-2">
            <Label htmlFor="disability_type">Disability Type</Label>
            <Select
              value={form.disability_type}
              onValueChange={(v) => setField("disability_type", v)}
            >
              <SelectTrigger id="disability_type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {DISABILITY_TYPES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Ownership Type */}
        <div className="space-y-2">
          <Label htmlFor="ownership_type">Ownership Type</Label>
          <Select
            value={form.ownership_type}
            onValueChange={(v) => setField("ownership_type", v)}
          >
            <SelectTrigger id="ownership_type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {OWNERSHIP_TYPES.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Business Longevity */}
        <div className="space-y-2">
          <Label htmlFor="business_longevity">Business Longevity (years)</Label>
          <Input
            id="business_longevity"
            type="number"
            min={0}
            value={form.business_longevity}
            onChange={(e) => setField("business_longevity", e.target.value)}
            placeholder="Years in operation"
          />
        </div>

        {/* Business Size */}
        <div className="space-y-2">
          <Label htmlFor="business_size">Business Size</Label>
          <Select
            value={form.business_size}
            onValueChange={(v) => setField("business_size", v)}
          >
            <SelectTrigger id="business_size">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_SIZES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Funding Status */}
        <div className="space-y-2">
          <Label htmlFor="funding_status">Funding Status</Label>
          <Select
            value={form.funding_status}
            onValueChange={(v) => setField("funding_status", v)}
          >
            <SelectTrigger id="funding_status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {FUNDING_STATUSES.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Business Registered */}
        <div className="space-y-2">
          <Label htmlFor="business_registered">Business Registered</Label>
          <Select
            value={form.business_registered}
            onValueChange={(v) => setField("business_registered", v)}
          >
            <SelectTrigger id="business_registered">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Business Sector */}
        <div className="space-y-2">
          <Label htmlFor="business_sector">Business Sector</Label>
          <Select
            value={form.business_sector}
            onValueChange={(v) => setField("business_sector", v)}
          >
            <SelectTrigger id="business_sector">
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_SECTORS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Learning */}
      <div className="space-y-2">
        <Label htmlFor="learning">Learnings</Label>
        <Textarea
          id="learning"
          value={form.learning}
          onChange={(e) => setField("learning", e.target.value)}
          placeholder="Any learnings or insights from this application..."
          rows={3}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          onClick={() => handleSubmit(false)}
          disabled={saving}
          className="bg-srsf-green-500 hover:bg-srsf-green-600"
        >
          {saving ? "Saving..." : editEntry ? "Update Entry" : "Submit Entry"}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSubmit(true)}
          disabled={saving}
        >
          Save as Draft
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/data-entry/enterprise-spotlight-form.tsx
git commit -m "feat: add Enterprise Spotlight data entry form with 13 fields"
```

---

### Task 6: Media Program Form (Virtual University + Hangout)

**Files:**
- Create: `src/components/data-entry/media-program-form.tsx`

The Virtual University and Hangout forms are identical per the spec. This single component handles both, receiving the program slug as a prop.

- [ ] **Step 1: Create the shared media program form component**

Create `src/components/data-entry/media-program-form.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { MediaProgramEntry } from "@/lib/types";
import { PLATFORMS, GENDERS, AGE_BRACKETS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface MediaProgramFormProps {
  tableName: "virtual_university_entries" | "hangout_entries";
  programLabel: string;
  editEntry?: MediaProgramEntry | null;
  onSaved: () => void;
  onCancel?: () => void;
}

interface PlatformMetrics {
  views: string;
  shares: string;
  saves: string;
  likes: string;
}

const EMPTY_METRICS: PlatformMetrics = {
  views: "",
  shares: "",
  saves: "",
  likes: "",
};

export function MediaProgramForm({
  tableName,
  programLabel,
  editEntry,
  onSaved,
  onCancel,
}: MediaProgramFormProps) {
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [dateAired, setDateAired] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [platformMetrics, setPlatformMetrics] = useState<
    Record<string, PlatformMetrics>
  >({
    Facebook: { ...EMPTY_METRICS },
    YouTube: { ...EMPTY_METRICS },
  });
  const [genderCounts, setGenderCounts] = useState<Record<string, string>>({});
  const [ageBracketCounts, setAgeBracketCounts] = useState<
    Record<string, string>
  >({});
  const [learning, setLearning] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (editEntry) {
      setEpisodeTitle(editEntry.episode_title);
      setDateAired(editEntry.date_aired ?? "");
      setSelectedPlatforms(editEntry.platforms);
      const metricsState: Record<string, PlatformMetrics> = {
        Facebook: { ...EMPTY_METRICS },
        YouTube: { ...EMPTY_METRICS },
      };
      for (const p of PLATFORMS) {
        const key = p.toLowerCase() as "facebook" | "youtube";
        const m = editEntry.metrics[key];
        if (m) {
          metricsState[p] = {
            views: m.views?.toString() ?? "",
            shares: m.shares?.toString() ?? "",
            saves: m.saves?.toString() ?? "",
            likes: m.likes?.toString() ?? "",
          };
        }
      }
      setPlatformMetrics(metricsState);
      const gc: Record<string, string> = {};
      for (const [k, v] of Object.entries(editEntry.demographics.gender ?? {})) {
        gc[k] = v.toString();
      }
      setGenderCounts(gc);
      const ac: Record<string, string> = {};
      for (const [k, v] of Object.entries(
        editEntry.demographics.age_brackets ?? {}
      )) {
        ac[k] = v.toString();
      }
      setAgeBracketCounts(ac);
      setLearning(editEntry.learning);
    }
  }, [editEntry]);

  function togglePlatform(platform: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }

  function setMetric(
    platform: string,
    field: keyof PlatformMetrics,
    value: string
  ) {
    setPlatformMetrics((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }));
  }

  async function handleSubmit(isDraft: boolean) {
    if (!isDraft && !episodeTitle.trim()) {
      toast.error("Episode title is required");
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      setSaving(false);
      return;
    }

    const metrics: Record<
      string,
      { views: number; shares: number; saves: number; likes: number }
    > = {};
    for (const p of selectedPlatforms) {
      const pm = platformMetrics[p];
      metrics[p.toLowerCase()] = {
        views: parseInt(pm.views, 10) || 0,
        shares: parseInt(pm.shares, 10) || 0,
        saves: parseInt(pm.saves, 10) || 0,
        likes: parseInt(pm.likes, 10) || 0,
      };
    }

    const demographics = {
      gender: Object.fromEntries(
        Object.entries(genderCounts)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, parseInt(v, 10) || 0])
      ),
      age_brackets: Object.fromEntries(
        Object.entries(ageBracketCounts)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, parseInt(v, 10) || 0])
      ),
    };

    const record = {
      user_id: user.id,
      episode_title: episodeTitle,
      date_aired: dateAired || null,
      platforms: selectedPlatforms,
      metrics,
      demographics,
      learning,
      is_draft: isDraft,
    };

    let error;
    if (editEntry) {
      ({ error } = await supabase
        .from(tableName)
        .update(record)
        .eq("id", editEntry.id));
    } else {
      ({ error } = await supabase.from(tableName).insert(record));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      isDraft
        ? "Draft saved"
        : editEntry
          ? "Entry updated"
          : "Entry submitted"
    );
    // Reset form
    setEpisodeTitle("");
    setDateAired("");
    setSelectedPlatforms([]);
    setPlatformMetrics({
      Facebook: { ...EMPTY_METRICS },
      YouTube: { ...EMPTY_METRICS },
    });
    setGenderCounts({});
    setAgeBracketCounts({});
    setLearning("");
    onSaved();
  }

  return (
    <div className="space-y-6">
      {/* Episode Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="episode_title">Episode Title *</Label>
          <Input
            id="episode_title"
            value={episodeTitle}
            onChange={(e) => setEpisodeTitle(e.target.value)}
            placeholder="Episode title"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_aired">Date Aired</Label>
          <Input
            id="date_aired"
            type="date"
            value={dateAired}
            onChange={(e) => setDateAired(e.target.value)}
          />
        </div>
      </div>

      {/* Platform Selection */}
      <div className="space-y-3">
        <Label>Platforms</Label>
        <div className="flex gap-4">
          {PLATFORMS.map((platform) => (
            <label
              key={platform}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={selectedPlatforms.includes(platform)}
                onCheckedChange={() => togglePlatform(platform)}
              />
              <span className="text-sm">{platform}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Per-Platform Metrics */}
      {selectedPlatforms.map((platform) => (
        <div
          key={platform}
          className="rounded-lg border p-4 space-y-3"
        >
          <h4 className="font-medium">{platform} Metrics</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["views", "shares", "saves", "likes"] as const).map((field) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs capitalize">{field}</Label>
                <Input
                  type="number"
                  min={0}
                  value={platformMetrics[platform]?.[field] ?? ""}
                  onChange={(e) => setMetric(platform, field, e.target.value)}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Audience Demographics — Gender */}
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="font-medium">Audience Demographics — Gender</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {GENDERS.map((g) => (
            <div key={g} className="space-y-1">
              <Label className="text-xs">{g}</Label>
              <Input
                type="number"
                min={0}
                value={genderCounts[g] ?? ""}
                onChange={(e) =>
                  setGenderCounts((prev) => ({
                    ...prev,
                    [g]: e.target.value,
                  }))
                }
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Audience Demographics — Age Bracket */}
      <div className="rounded-lg border p-4 space-y-3">
        <h4 className="font-medium">Audience Demographics — Age Bracket</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {AGE_BRACKETS.map((ab) => (
            <div key={ab} className="space-y-1">
              <Label className="text-xs">{ab}</Label>
              <Input
                type="number"
                min={0}
                value={ageBracketCounts[ab] ?? ""}
                onChange={(e) =>
                  setAgeBracketCounts((prev) => ({
                    ...prev,
                    [ab]: e.target.value,
                  }))
                }
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Learning */}
      <div className="space-y-2">
        <Label htmlFor="learning">Learnings</Label>
        <Textarea
          id="learning"
          value={learning}
          onChange={(e) => setLearning(e.target.value)}
          placeholder={`Any learnings or insights from this ${programLabel} episode...`}
          rows={3}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          onClick={() => handleSubmit(false)}
          disabled={saving}
          className="bg-srsf-green-500 hover:bg-srsf-green-600"
        >
          {saving ? "Saving..." : editEntry ? "Update Entry" : "Submit Entry"}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSubmit(true)}
          disabled={saving}
        >
          Save as Draft
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/data-entry/media-program-form.tsx
git commit -m "feat: add shared media program form for Virtual University and Hangout"
```

---

### Task 7: ABSA Onboarding Form

**Files:**
- Create: `src/components/data-entry/absa-onboarding-form.tsx`

- [ ] **Step 1: Create the ABSA Onboarding form component**

Create `src/components/data-entry/absa-onboarding-form.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AbsaOnboardingEntry } from "@/lib/types";
import { getAgeBracket } from "@/lib/utils";
import { REGIONS, GENDERS, EMPLOYMENT_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";

interface AbsaOnboardingFormProps {
  editEntry?: AbsaOnboardingEntry | null;
  onSaved: () => void;
  onCancel?: () => void;
}

const EMPTY_FORM = {
  participant_name: "",
  gender: "",
  age: "",
  region: "",
  employment_status: "",
  disability_status: "",
  learning: "",
};

export function AbsaOnboardingForm({
  editEntry,
  onSaved,
  onCancel,
}: AbsaOnboardingFormProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (editEntry) {
      setForm({
        participant_name: editEntry.participant_name,
        gender: editEntry.gender,
        age: editEntry.age?.toString() ?? "",
        region: editEntry.region,
        employment_status: editEntry.employment_status,
        disability_status: editEntry.disability_status,
        learning: editEntry.learning,
      });
    }
  }, [editEntry]);

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(isDraft: boolean) {
    if (!isDraft && !form.participant_name.trim()) {
      toast.error("Participant name is required");
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      setSaving(false);
      return;
    }

    const ageNum = form.age ? parseInt(form.age, 10) : null;
    const record = {
      user_id: user.id,
      participant_name: form.participant_name,
      gender: form.gender,
      age: ageNum,
      age_bracket: ageNum ? getAgeBracket(ageNum) : "",
      region: form.region,
      employment_status: form.employment_status,
      disability_status: form.disability_status,
      learning: form.learning,
      is_draft: isDraft,
    };

    let error;
    if (editEntry) {
      ({ error } = await supabase
        .from("absa_onboarding_entries")
        .update(record)
        .eq("id", editEntry.id));
    } else {
      ({ error } = await supabase
        .from("absa_onboarding_entries")
        .insert(record));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      isDraft
        ? "Draft saved"
        : editEntry
          ? "Entry updated"
          : "Entry submitted"
    );
    setForm(EMPTY_FORM);
    onSaved();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Participant Name */}
        <div className="space-y-2">
          <Label htmlFor="participant_name">Participant Name *</Label>
          <Input
            id="participant_name"
            value={form.participant_name}
            onChange={(e) => setField("participant_name", e.target.value)}
            placeholder="Full name"
          />
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select
            value={form.gender}
            onValueChange={(v) => setField("gender", v)}
          >
            <SelectTrigger id="gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              {GENDERS.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Age */}
        <div className="space-y-2">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            type="number"
            min={0}
            max={150}
            value={form.age}
            onChange={(e) => setField("age", e.target.value)}
            placeholder="Age in years"
          />
          {form.age && (
            <p className="text-xs text-muted-foreground">
              Bracket: {getAgeBracket(parseInt(form.age, 10))}
            </p>
          )}
        </div>

        {/* Region */}
        <div className="space-y-2">
          <Label htmlFor="region">Region</Label>
          <Select
            value={form.region}
            onValueChange={(v) => setField("region", v)}
          >
            <SelectTrigger id="region">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Employment Status */}
        <div className="space-y-2">
          <Label htmlFor="employment_status">Employment Status</Label>
          <Select
            value={form.employment_status}
            onValueChange={(v) => setField("employment_status", v)}
          >
            <SelectTrigger id="employment_status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYMENT_STATUSES.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Disability Status */}
        <div className="space-y-2">
          <Label htmlFor="disability_status">Disability Status</Label>
          <Select
            value={form.disability_status}
            onValueChange={(v) => setField("disability_status", v)}
          >
            <SelectTrigger id="disability_status">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Learning */}
      <div className="space-y-2">
        <Label htmlFor="learning">Learnings</Label>
        <Textarea
          id="learning"
          value={form.learning}
          onChange={(e) => setField("learning", e.target.value)}
          placeholder="Any learnings or insights from this onboarding..."
          rows={3}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          onClick={() => handleSubmit(false)}
          disabled={saving}
          className="bg-srsf-green-500 hover:bg-srsf-green-600"
        >
          {saving ? "Saving..." : editEntry ? "Update Entry" : "Submit Entry"}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSubmit(true)}
          disabled={saving}
        >
          Save as Draft
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/data-entry/absa-onboarding-form.tsx
git commit -m "feat: add ABSA Onboarding data entry form"
```

---

### Task 8: Learnings Form

**Files:**
- Create: `src/components/data-entry/learnings-form.tsx`

- [ ] **Step 1: Create the learnings form component**

Create `src/components/data-entry/learnings-form.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { LearningEntry, Program } from "@/lib/types";
import { LEARNING_CATEGORIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";

interface LearningsFormProps {
  editEntry?: LearningEntry | null;
  onSaved: () => void;
  onCancel?: () => void;
}

const EMPTY_FORM = {
  program_id: "",
  category: "",
  title: "",
  description: "",
  learning_date: "",
};

export function LearningsForm({
  editEntry,
  onSaved,
  onCancel,
}: LearningsFormProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function loadPrograms() {
      const { data } = await supabase
        .from("programs")
        .select("*")
        .order("name");
      if (data) setPrograms(data);
    }
    loadPrograms();
  }, [supabase]);

  useEffect(() => {
    if (editEntry) {
      setForm({
        program_id: editEntry.program_id,
        category: editEntry.category,
        title: editEntry.title,
        description: editEntry.description,
        learning_date: editEntry.learning_date ?? "",
      });
    }
  }, [editEntry]);

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.program_id) {
      toast.error("Please select a program");
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in");
      setSaving(false);
      return;
    }

    const record = {
      user_id: user.id,
      program_id: form.program_id,
      category: form.category,
      title: form.title,
      description: form.description,
      learning_date: form.learning_date || null,
    };

    let error;
    if (editEntry) {
      ({ error } = await supabase
        .from("learnings")
        .update(record)
        .eq("id", editEntry.id));
    } else {
      ({ error } = await supabase.from("learnings").insert(record));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editEntry ? "Learning updated" : "Learning submitted");
    setForm(EMPTY_FORM);
    onSaved();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Program */}
        <div className="space-y-2">
          <Label htmlFor="program_id">Program *</Label>
          <Select
            value={form.program_id}
            onValueChange={(v) => setField("program_id", v)}
          >
            <SelectTrigger id="program_id">
              <SelectValue placeholder="Select program" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category">Category / Theme</Label>
          <Select
            value={form.category}
            onValueChange={(v) => setField("category", v)}
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {LEARNING_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Learning Title *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="Short descriptive title"
          />
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label htmlFor="learning_date">Date of Learning</Label>
          <Input
            id="learning_date"
            type="date"
            value={form.learning_date}
            onChange={(e) => setField("learning_date", e.target.value)}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="Describe the learning in detail..."
          rows={5}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-srsf-green-500 hover:bg-srsf-green-600"
        >
          {saving
            ? "Saving..."
            : editEntry
              ? "Update Learning"
              : "Submit Learning"}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/data-entry/learnings-form.tsx
git commit -m "feat: add learnings data entry form"
```

---

### Task 9: Recent Entries Table

**Files:**
- Create: `src/components/data-entry/recent-entries-table.tsx`

This component shows the last 10 entries for the selected program with edit and delete actions.

- [ ] **Step 1: Create the recent entries table component**

Create `src/components/data-entry/recent-entries-table.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProgramSlug, PROGRAM_TABLE_MAP } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface RecentEntriesTableProps {
  programSlug: ProgramSlug;
  refreshKey: number;
  onEdit: (entry: Record<string, unknown>) => void;
}

function getDisplayColumns(
  slug: ProgramSlug
): { key: string; label: string }[] {
  switch (slug) {
    case "enterprise-spotlight":
      return [
        { key: "applicant_name", label: "Applicant" },
        { key: "region", label: "Region" },
        { key: "gender", label: "Gender" },
        { key: "business_sector", label: "Sector" },
      ];
    case "virtual-university":
    case "hangout":
      return [
        { key: "episode_title", label: "Episode" },
        { key: "date_aired", label: "Date Aired" },
        { key: "platforms", label: "Platforms" },
      ];
    case "absa-onboarding":
      return [
        { key: "participant_name", label: "Participant" },
        { key: "region", label: "Region" },
        { key: "gender", label: "Gender" },
        { key: "employment_status", label: "Employment" },
      ];
    case "learnings":
      return [
        { key: "title", label: "Title" },
        { key: "category", label: "Category" },
        { key: "learning_date", label: "Date" },
      ];
  }
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function RecentEntriesTable({
  programSlug,
  refreshKey,
  onEdit,
}: RecentEntriesTableProps) {
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const tableName = PROGRAM_TABLE_MAP[programSlug];
  const columns = getDisplayColumns(programSlug);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const query = supabase
      .from(tableName)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load entries");
    }
    setEntries((data as Record<string, unknown>[]) ?? []);
    setLoading(false);
  }, [supabase, tableName]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries, refreshKey]);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    const { error } = await supabase.from(tableName).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Entry deleted");
    loadEntries();
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground py-4">Loading entries...</p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No entries yet. Submit your first entry above.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id as string}>
              {columns.map((col) => (
                <TableCell key={col.key}>
                  {formatCellValue(entry[col.key])}
                </TableCell>
              ))}
              <TableCell>
                {entry.is_draft ? (
                  <Badge variant="secondary">Draft</Badge>
                ) : (
                  <Badge className="bg-srsf-green-100 text-srsf-green-800">
                    Submitted
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(entry)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(entry.id as string)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/data-entry/recent-entries-table.tsx
git commit -m "feat: add recent entries table with edit and delete actions"
```

---

### Task 10: Data Entry Page — Wire Everything Together

**Files:**
- Modify: `src/app/(dashboard)/data-entry/page.tsx`

This replaces the placeholder with the full data entry module: program selector → form → recent entries.

- [ ] **Step 1: Replace the data entry page with the full implementation**

Replace the entire contents of `src/app/(dashboard)/data-entry/page.tsx` with:

```tsx
"use client";

import { useState, useCallback } from "react";
import { ProgramSlug } from "@/lib/types";
import { ProgramSelector } from "@/components/data-entry/program-selector";
import { EnterpriseSpotlightForm } from "@/components/data-entry/enterprise-spotlight-form";
import { MediaProgramForm } from "@/components/data-entry/media-program-form";
import { AbsaOnboardingForm } from "@/components/data-entry/absa-onboarding-form";
import { LearningsForm } from "@/components/data-entry/learnings-form";
import { RecentEntriesTable } from "@/components/data-entry/recent-entries-table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PROGRAM_LABELS: Record<ProgramSlug, string> = {
  "enterprise-spotlight": "Enterprise Spotlight",
  "virtual-university": "Virtual University",
  "hangout": "Hangout",
  "absa-onboarding": "ABSA Onboarding",
  "learnings": "Learnings",
};

export default function DataEntryPage() {
  const [selectedProgram, setSelectedProgram] = useState<ProgramSlug | null>(
    null
  );
  const [editEntry, setEditEntry] = useState<Record<string, unknown> | null>(
    null
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setEditEntry(null);
  }, []);

  const handleEdit = useCallback((entry: Record<string, unknown>) => {
    setEditEntry(entry);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleCancel = useCallback(() => {
    setEditEntry(null);
  }, []);

  function renderForm() {
    switch (selectedProgram) {
      case "enterprise-spotlight":
        return (
          <EnterpriseSpotlightForm
            editEntry={editEntry as never}
            onSaved={handleSaved}
            onCancel={editEntry ? handleCancel : undefined}
          />
        );
      case "virtual-university":
        return (
          <MediaProgramForm
            tableName="virtual_university_entries"
            programLabel="Virtual University"
            editEntry={editEntry as never}
            onSaved={handleSaved}
            onCancel={editEntry ? handleCancel : undefined}
          />
        );
      case "hangout":
        return (
          <MediaProgramForm
            tableName="hangout_entries"
            programLabel="Hangout"
            editEntry={editEntry as never}
            onSaved={handleSaved}
            onCancel={editEntry ? handleCancel : undefined}
          />
        );
      case "absa-onboarding":
        return (
          <AbsaOnboardingForm
            editEntry={editEntry as never}
            onSaved={handleSaved}
            onCancel={editEntry ? handleCancel : undefined}
          />
        );
      case "learnings":
        return (
          <LearningsForm
            editEntry={editEntry as never}
            onSaved={handleSaved}
            onCancel={editEntry ? handleCancel : undefined}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Entry</h1>
        <p className="text-muted-foreground mt-1">
          Enter data for any program. All submissions feed into dashboards
          automatically.
        </p>
      </div>

      {!selectedProgram ? (
        <ProgramSelector onSelect={setSelectedProgram} />
      ) : (
        <div className="space-y-6">
          {/* Back button + program title */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedProgram(null);
                setEditEntry(null);
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h2 className="text-lg font-semibold">
              {PROGRAM_LABELS[selectedProgram]}
              {editEntry ? " — Editing Entry" : " — New Entry"}
            </h2>
          </div>

          {/* Form */}
          <div className="rounded-lg border bg-card p-6">{renderForm()}</div>

          {/* Recent entries */}
          <div>
            <h3 className="text-base font-semibold mb-3">Recent Entries</h3>
            <RecentEntriesTable
              programSlug={selectedProgram}
              refreshKey={refreshKey}
              onEdit={handleEdit}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/data-entry/page.tsx
git commit -m "feat: wire up data entry page with program selector, forms, and recent entries"
```

---

### Task 11: Manual Verification + Polish

**Files:** None new — this is a verification pass.

- [ ] **Step 1: Run the dev server**

Run: `npm run dev`
Expected: Server starts without errors on http://localhost:3000

- [ ] **Step 2: Verify the data entry page**

Navigate to http://localhost:3000/data-entry and verify:
1. Five program cards display with icons and descriptions
2. Clicking a card shows the corresponding form with a back button
3. The form has all expected fields per the design spec
4. "Save as Draft" and "Submit Entry" buttons are visible
5. The "Recent Entries" section shows below the form (empty initially)

**Note:** Forms will only submit successfully after the 002_program_data.sql migration is run in Supabase. Until then, form submissions will fail with a "relation does not exist" error — that is expected.

- [ ] **Step 3: Verify Enterprise Spotlight form fields**

Check that the ES form has all 13 fields:
- Applicant Name (text input)
- Region (dropdown: 9 provinces)
- Gender (dropdown: 4 options)
- Age (number input with bracket display)
- Disability Status (Yes/No dropdown)
- Disability Type (conditional — only shows when status = Yes)
- Ownership Type (dropdown: 6 options)
- Business Longevity (number input)
- Business Size (dropdown: 4 options)
- Funding Status (dropdown: 5 options)
- Business Registered (Yes/No dropdown)
- Business Sector (dropdown: 13 options)
- Learnings (textarea)

- [ ] **Step 4: Verify media program form (VU/Hangout)**

Check that both VU and Hangout forms have:
- Episode Title (text input)
- Date Aired (date input)
- Platform checkboxes (Facebook, YouTube)
- Per-platform metrics section (views, shares, saves, likes) — appears per selected platform
- Gender demographics (count inputs per gender)
- Age bracket demographics (count inputs per bracket)
- Learnings (textarea)

- [ ] **Step 5: Verify ABSA Onboarding form**

Check 6 fields: Participant Name, Gender, Age, Region, Employment Status, Disability Status, plus Learnings textarea.

- [ ] **Step 6: Verify Learnings form**

Check fields: Program (dropdown from DB), Category (5 options), Title, Date, Description.

- [ ] **Step 7: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: polish data entry forms after manual verification"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration (tables + RLS + indicators seed) | `supabase/migrations/002_program_data.sql` |
| 2 | TypeScript types for entries + indicators | `src/lib/types.ts` |
| 3 | Form option constants + age bracket utility | `src/lib/constants.ts`, `src/lib/utils.ts` |
| 4 | Program selector card component | `src/components/data-entry/program-selector.tsx` |
| 5 | Enterprise Spotlight form (13 fields) | `src/components/data-entry/enterprise-spotlight-form.tsx` |
| 6 | Media program form (VU + Hangout shared) | `src/components/data-entry/media-program-form.tsx` |
| 7 | ABSA Onboarding form (6 fields) | `src/components/data-entry/absa-onboarding-form.tsx` |
| 8 | Learnings form | `src/components/data-entry/learnings-form.tsx` |
| 9 | Recent entries table (edit + delete) | `src/components/data-entry/recent-entries-table.tsx` |
| 10 | Data entry page (wires selector → form → table) | `src/app/(dashboard)/data-entry/page.tsx` |
| 11 | Manual verification + polish | — |

**Post-implementation:** Run `002_program_data.sql` in the Supabase SQL Editor to create the tables. Until that migration runs, the forms will render but submissions will fail.

**Not included in this phase (deferred):**
- Bulk upload (Excel I/O) — Phase 7
- Dynamic custom indicator fields on forms — Phase 5 (Indicators Management)
- Dashboard read queries — Phase 3
