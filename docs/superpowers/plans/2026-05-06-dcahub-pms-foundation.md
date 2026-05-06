# DC&A Hub PMS — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new `dcahub-pms` repo, with a working Supabase project, the full schema + RLS, role-based auth, and three empty role-home shells. After this plan, an admin/staff/client user can log in and land on their correct home page (which is otherwise empty). No project-management features yet — that's Plan 2 onwards.

**Architecture:** Copy `springboard-mis` to a new repo, swap branding, point at a brand-new Supabase project, replace the schema with the DC&A Hub PMS schema, and add role-aware middleware. SRSF-specific UI/routes are pruned only where they conflict with the new shape; the rest is left until later plans need to touch it.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + Auth + Storage + RLS), TypeScript, shadcn/ui, Tailwind v4, Vitest (added in this plan), `@supabase/ssr`.

**Spec:** [`docs/superpowers/specs/2026-05-06-dcahub-pms-design.md`](../specs/2026-05-06-dcahub-pms-design.md)

---

## File Structure (high level after this plan)

```
dcahub-pms/
  src/
    app/
      (auth)/login/page.tsx
      admin/page.tsx              # empty shell
      workspace/page.tsx          # empty shell
      portal/page.tsx             # empty shell
      layout.tsx
      page.tsx                    # redirects to role home
    lib/
      supabase/
        server.ts                 # adapted from springboard-mis
        client.ts                 # adapted from springboard-mis
        types.ts                  # generated from new Supabase project
      auth/
        get-current-profile.ts    # NEW
        require-role.ts           # NEW
    middleware.ts                 # NEW (role routing)
  supabase/
    migrations/
      0001_init_schema.sql        # tables + indexes
      0002_rls_policies.sql       # RLS + can_access_project()
      0003_storage_bucket.sql     # proofs bucket + policy
    seed.sql                      # idempotent admin seed
  tests/
    rls/
      rls.test.ts                 # integration tests for RLS
    middleware/
      role-routing.test.ts        # unit tests for middleware logic
  vitest.config.ts                # NEW
  .env.local.example              # NEW
  README.md                       # rewritten
```

---

## Task 1: Bootstrap the new repo

**Files:**
- Create: `C:/Users/ishma/Desktop/dcahub-pms/` (entire copied tree)
- Modify: `package.json` (name, description)
- Modify: `README.md` (rewrite)
- Delete: `.git/` from copy, `node_modules/`, `tsconfig.tsbuildinfo`

- [ ] **Step 1: Copy springboard-mis to dcahub-pms (excluding heavy/local-only dirs)**

```powershell
robocopy "C:\Users\ishma\Desktop\springboard-mis" "C:\Users\ishma\Desktop\dcahub-pms" /E /XD node_modules .next .git /XF tsconfig.tsbuildinfo
```

Expected: robocopy summary shows files copied, `node_modules`, `.next`, `.git` skipped.

- [ ] **Step 2: Initialise fresh git repo**

```powershell
cd C:\Users\ishma\Desktop\dcahub-pms
git init
git add -A
git commit -m "chore: initial copy from springboard-mis"
```

Expected: one initial commit on `main`, no link to springboard-mis history.

- [ ] **Step 3: Update `package.json` name and description**

Edit `package.json`:

```json
{
  "name": "dcahub-pms",
  "version": "0.1.0",
  "private": true,
  "description": "DC&A Hub Project Management System",
  ...
}
```

Leave dependencies alone for now. We'll add Vitest in Task 4.

- [ ] **Step 4: Rewrite `README.md`**

Replace contents with:

```markdown
# DC&A Hub PMS

Project Management System for DC&A Hub. Lets DC&A Hub staff track project work (phases, activities, proofs) and lets clients log in to see live progress on their project.

See [`docs/superpowers/specs/2026-05-06-dcahub-pms-design.md`](docs/superpowers/specs/2026-05-06-dcahub-pms-design.md) for the design spec.

## Stack

Next.js 16 (App Router), Supabase, TypeScript, shadcn/ui, Tailwind v4.

## Local development

```bash
npm install
cp .env.local.example .env.local
# fill in Supabase keys
npm run dev
```

## Tests

```bash
npm test
```
```

- [ ] **Step 5: Install dependencies**

```powershell
npm install
```

Expected: `node_modules` populated, no errors.

- [ ] **Step 6: Verify the dev server still boots**

```powershell
npm run dev
```

Expected: Next.js starts on http://localhost:3000 without crashing. Cancel with Ctrl+C. (The page may show errors due to bad/missing env vars — that's fine, we're only checking the build doesn't break.)

- [ ] **Step 7: Commit**

```powershell
git add package.json README.md
git commit -m "chore: rebrand package and README to dcahub-pms"
```

- [ ] **Step 8: Move design spec into the new repo**

```powershell
xcopy "C:\Users\ishma\Desktop\dcahub-pms-spec\docs" "C:\Users\ishma\Desktop\dcahub-pms\docs" /E /I /Y
git add docs
git commit -m "docs: add design spec and foundation plan"
```

---

## Task 2: Inventory and prune SRSF-specific code

The springboard-mis repo has SRSF-specific routes/components/migrations. We're not deleting everything — only what's certain to conflict with the new schema or branding. The rest gets removed lazily in later plans as we touch each surface.

**Files:**
- Inspect: `src/app/`, `src/features/`, `supabase/migrations/`, `src/lib/`
- Delete: any existing supabase migrations (we're starting fresh)
- Delete: any SRSF-specific page routes that have nothing to do with auth, layout, or shadcn primitives

- [ ] **Step 1: List existing routes**

```powershell
Get-ChildItem -Recurse src\app -Filter "page.tsx" | Select-Object FullName
```

Note them down. Anything that's clearly SRSF (e.g. `/programs`, `/cohorts`, `/youth`, `/srsf-*`) is a candidate for deletion. Anything generic (`/login`, `/account`, `/`, `layout.tsx`) is kept.

- [ ] **Step 2: List existing migrations**

```powershell
Get-ChildItem supabase\migrations
```

- [ ] **Step 3: Remove all existing migrations**

We're rebuilding the schema from scratch. Delete every file in `supabase/migrations/`.

```powershell
Remove-Item supabase\migrations\* -Force
```

- [ ] **Step 4: Remove SRSF-specific feature folders**

Delete any folder under `src/features/` whose name refers to SRSF concepts (cohorts, programs, etc.). Keep:
- generic UI primitives
- auth/login feature folder if present
- shared layout components

Use judgement; when in doubt, leave it alone — it can be removed later when its file gets edited.

- [ ] **Step 5: Remove SRSF-specific page routes**

Delete every `src/app/<srsf-domain-route>/` folder. Keep `(auth)`, `login`, `layout.tsx`, `page.tsx`, and any generic shells.

- [ ] **Step 6: Verify the app still builds**

```powershell
npm run build
```

Expected: build succeeds. If TypeScript fails because a deleted component is still imported somewhere, follow the import chain and either delete the importer or stub the import. Repeat until build is green.

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "chore: prune SRSF-specific code"
```

---

## Task 3: Create the new Supabase project and wire env vars

This task is partly manual (Supabase dashboard).

**Files:**
- Create: `.env.local.example`
- Create: `.env.local` (gitignored)
- Modify: `.gitignore` if needed (verify `.env.local` is ignored)

- [ ] **Step 1: Create new Supabase project**

In the Supabase dashboard (https://supabase.com/dashboard):
1. New project → name `dcahub-pms` → choose region closest to Ghana (e.g. `eu-west-2` London or `eu-central-1` Frankfurt) → set DB password (save it).
2. Wait for provisioning (~2 min).

- [ ] **Step 2: Install the Supabase CLI locally if not present**

```powershell
npm install -D supabase
```

- [ ] **Step 3: Link the local repo to the new Supabase project**

```powershell
npx supabase login
npx supabase link --project-ref <YOUR_PROJECT_REF>
```

Project ref is in the project URL: `https://<ref>.supabase.co`.

- [ ] **Step 4: Create `.env.local.example`**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_NAME=DC&A Hub PMS
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email (added in Plan 4; leave empty for now)
RESEND_API_KEY=
```

- [ ] **Step 5: Create `.env.local` with real values**

Copy `.env.local.example` to `.env.local` and fill in the real values from Supabase dashboard → Project Settings → API.

- [ ] **Step 6: Verify `.gitignore` excludes `.env.local`**

```powershell
git check-ignore .env.local
```

Expected: prints `.env.local`. If it doesn't, add `.env.local` to `.gitignore`.

- [ ] **Step 7: Commit example file**

```powershell
git add .env.local.example .gitignore
git commit -m "chore: add .env.local.example wired to new Supabase project"
```

---

## Task 4: Add Vitest for unit + integration tests

**Files:**
- Modify: `package.json` (devDeps + scripts)
- Create: `vitest.config.ts`
- Create: `tests/.gitkeep`

- [ ] **Step 1: Install Vitest and helpers**

```powershell
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Add test scripts to `package.json`**

In `package.json`, under `scripts`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:rls": "vitest run tests/rls"
  }
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Add a smoke test to confirm Vitest works**

Create `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

```powershell
npm test
```

Expected: 1 test passing.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json vitest.config.ts tests
git commit -m "chore: add vitest with smoke test"
```

---

## Task 5: Write the schema migration

**Files:**
- Create: `supabase/migrations/0001_init_schema.sql`

This task has no traditional TDD because it's pure DDL. Verification = applying the migration cleanly.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_init_schema.sql`:

```sql
-- DC&A Hub PMS — initial schema
-- Tables: profiles, clients, projects, project_members, phases, activities, activity_proofs, activity_log

create extension if not exists "pgcrypto";

-- profiles ------------------------------------------------------------------
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('admin','staff','client')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_user_id_idx on profiles(user_id);
create index profiles_role_idx on profiles(role);

-- clients -------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- projects ------------------------------------------------------------------
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  client_id uuid not null references clients(id) on delete restrict,
  start_date date,
  end_date date,
  status text not null default 'planning' check (status in ('planning','active','paused','completed')),
  description text,
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_client_id_idx on projects(client_id);
create index projects_status_idx on projects(status);

-- project_members -----------------------------------------------------------
create table project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_role text not null check (project_role in ('member','viewer')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);
create index project_members_project_id_idx on project_members(project_id);
create index project_members_user_id_idx on project_members(user_id);

-- phases --------------------------------------------------------------------
create table phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  start_date date,
  end_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index phases_project_id_idx on phases(project_id);
create index phases_order_idx on phases(project_id, order_index);

-- activities ----------------------------------------------------------------
create table activities (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references phases(id) on delete cascade,
  name text not null,
  description text,
  planned_date date,
  completed_date date,
  status text not null default 'not_started' check (status in ('not_started','in_progress','done')),
  location text,
  participants_count int,
  narrative_note text,
  order_index int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activities_phase_id_idx on activities(phase_id);
create index activities_status_idx on activities(status);

-- activity_proofs -----------------------------------------------------------
create table activity_proofs (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  caption text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index activity_proofs_activity_id_idx on activity_proofs(activity_id);

-- activity_log --------------------------------------------------------------
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  activity_id uuid references activities(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created','updated','marked_done','proof_added','proof_deleted')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_project_id_idx on activity_log(project_id);
create index activity_log_activity_id_idx on activity_log(activity_id);

-- updated_at trigger --------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();
create trigger projects_updated_at before update on projects
  for each row execute function set_updated_at();
create trigger phases_updated_at before update on phases
  for each row execute function set_updated_at();
create trigger activities_updated_at before update on activities
  for each row execute function set_updated_at();
```

- [ ] **Step 2: Apply the migration to the linked Supabase project**

```powershell
npx supabase db push
```

Expected: migration applied, no errors.

- [ ] **Step 3: Verify the tables exist**

In the Supabase dashboard → Table Editor: confirm all 8 tables are listed.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/0001_init_schema.sql
git commit -m "feat(db): initial schema (profiles, projects, phases, activities, proofs, log)"
```

---

## Task 6: Write the RLS migration

**Files:**
- Create: `supabase/migrations/0002_rls_policies.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0002_rls_policies.sql`:

```sql
-- DC&A Hub PMS — RLS policies

-- helper: is the current user an admin? -------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- helper: can the current user access a project (any membership) ----------
create or replace function public.can_access_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$;

-- helper: can the current user write to a project (member only) -----------
create or replace function public.can_write_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from project_members
    where project_id = p_project_id
      and user_id = auth.uid()
      and project_role = 'member'
  );
$$;

-- enable RLS on every table -------------------------------------------------
alter table profiles enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table phases enable row level security;
alter table activities enable row level security;
alter table activity_proofs enable row level security;
alter table activity_log enable row level security;

-- profiles ------------------------------------------------------------------
-- A user can read their own profile. Admin can read all.
create policy profiles_self_read on profiles for select
  using (user_id = auth.uid() or public.is_admin());

-- A user can update their own profile (not their role though — guarded in app).
create policy profiles_self_update on profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin manages profiles.
create policy profiles_admin_all on profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- clients -------------------------------------------------------------------
create policy clients_admin_all on clients for all
  using (public.is_admin()) with check (public.is_admin());

-- Staff/client members can read clients of projects they belong to.
create policy clients_member_read on clients for select
  using (
    exists (
      select 1 from projects p
      join project_members pm on pm.project_id = p.id
      where p.client_id = clients.id and pm.user_id = auth.uid()
    )
  );

-- projects ------------------------------------------------------------------
create policy projects_admin_all on projects for all
  using (public.is_admin()) with check (public.is_admin());

create policy projects_member_read on projects for select
  using (public.can_access_project(id));

create policy projects_member_write on projects for update
  using (public.can_write_project(id))
  with check (public.can_write_project(id));

-- project_members -----------------------------------------------------------
create policy project_members_admin_all on project_members for all
  using (public.is_admin()) with check (public.is_admin());

create policy project_members_self_read on project_members for select
  using (user_id = auth.uid() or public.can_access_project(project_id));

-- phases --------------------------------------------------------------------
create policy phases_read on phases for select
  using (public.can_access_project(project_id));

create policy phases_write on phases for all
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

-- activities ----------------------------------------------------------------
create policy activities_read on activities for select
  using (
    public.can_access_project(
      (select project_id from phases where phases.id = activities.phase_id)
    )
  );

create policy activities_write on activities for all
  using (
    public.can_write_project(
      (select project_id from phases where phases.id = activities.phase_id)
    )
  )
  with check (
    public.can_write_project(
      (select project_id from phases where phases.id = activities.phase_id)
    )
  );

-- activity_proofs -----------------------------------------------------------
create policy activity_proofs_read on activity_proofs for select
  using (
    public.can_access_project(
      (select p.project_id from phases p
        join activities a on a.phase_id = p.id
        where a.id = activity_proofs.activity_id)
    )
  );

create policy activity_proofs_write on activity_proofs for all
  using (
    public.can_write_project(
      (select p.project_id from phases p
        join activities a on a.phase_id = p.id
        where a.id = activity_proofs.activity_id)
    )
  )
  with check (
    public.can_write_project(
      (select p.project_id from phases p
        join activities a on a.phase_id = p.id
        where a.id = activity_proofs.activity_id)
    )
  );

-- activity_log --------------------------------------------------------------
-- Read: admin + project members (NOT viewers/clients).
create policy activity_log_member_read on activity_log for select
  using (
    public.is_admin() or exists (
      select 1 from project_members pm
      where pm.project_id = activity_log.project_id
        and pm.user_id = auth.uid()
        and pm.project_role = 'member'
    )
  );

-- Write: admin + members.
create policy activity_log_write on activity_log for insert
  with check (public.can_write_project(project_id));
```

- [ ] **Step 2: Apply the migration**

```powershell
npx supabase db push
```

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/0002_rls_policies.sql
git commit -m "feat(db): add RLS policies and access helpers"
```

---

## Task 7: Storage bucket + storage RLS

**Files:**
- Create: `supabase/migrations/0003_storage_bucket.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_storage_bucket.sql`:

```sql
-- DC&A Hub PMS — proofs storage bucket

insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;

-- helper: extract project_id from object path "projects/{uuid}/..."
create or replace function public.project_id_from_path(object_name text)
returns uuid language sql stable as $$
  select (
    case
      when object_name like 'projects/%/activities/%/%'
      then (split_part(object_name, '/', 2))::uuid
      else null
    end
  );
$$;

-- read: anyone who can access the project
create policy "proofs_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'proofs'
  and public.can_access_project(public.project_id_from_path(name))
);

-- write/upload: members + admin
create policy "proofs_write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'proofs'
  and public.can_write_project(public.project_id_from_path(name))
);

create policy "proofs_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'proofs'
  and public.can_write_project(public.project_id_from_path(name))
);

create policy "proofs_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'proofs'
  and public.can_write_project(public.project_id_from_path(name))
);
```

- [ ] **Step 2: Apply the migration**

```powershell
npx supabase db push
```

- [ ] **Step 3: Verify in dashboard**

Storage → buckets shows `proofs` as a private bucket.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/0003_storage_bucket.sql
git commit -m "feat(db): add proofs storage bucket and policies"
```

---

## Task 8: Generate TypeScript types from Supabase

**Files:**
- Create: `src/lib/supabase/types.ts` (generated)
- Modify: `package.json` (add a script)

- [ ] **Step 1: Add a script to regenerate types**

In `package.json` scripts:

```json
"db:types": "supabase gen types typescript --linked > src/lib/supabase/types.ts"
```

- [ ] **Step 2: Run it**

```powershell
npm run db:types
```

Expected: `src/lib/supabase/types.ts` populated with `Database` type.

- [ ] **Step 3: Commit**

```powershell
git add package.json src/lib/supabase/types.ts
git commit -m "feat: generate Supabase TypeScript types"
```

---

## Task 9: Adapt Supabase server + client utilities

springboard-mis already has Supabase utilities under `src/lib/supabase/`. We need them to use the generated `Database` type and the new env vars (which have the same names — no change needed there).

**Files:**
- Modify: `src/lib/supabase/server.ts`
- Modify: `src/lib/supabase/client.ts`

- [ ] **Step 1: Read existing files**

Open `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts`. They likely use `createServerClient` and `createBrowserClient` from `@supabase/ssr`.

- [ ] **Step 2: Add `Database` generic to client constructors**

In `client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

In `server.ts` (preserving the existing cookie-handling shape):

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component context — ignore.
          }
        },
      },
    },
  );
}
```

(If the existing code already differs in shape, keep its shape and only add the `<Database>` generic + import.)

- [ ] **Step 3: Verify the build passes**

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/supabase
git commit -m "feat: type Supabase clients with generated Database type"
```

---

## Task 10: Auth helpers — current profile + role guard

**Files:**
- Create: `src/lib/auth/get-current-profile.ts`
- Create: `src/lib/auth/require-role.ts`
- Create: `tests/auth/require-role.test.ts`

- [ ] **Step 1: Write the failing test for `requireRole`**

Create `tests/auth/require-role.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveHomeForRole, isRoleAllowed } from '@/lib/auth/require-role';

describe('resolveHomeForRole', () => {
  it('routes admin to /admin', () => {
    expect(resolveHomeForRole('admin')).toBe('/admin');
  });
  it('routes staff to /workspace', () => {
    expect(resolveHomeForRole('staff')).toBe('/workspace');
  });
  it('routes client to /portal', () => {
    expect(resolveHomeForRole('client')).toBe('/portal');
  });
  it('routes unauthenticated (null) to /login', () => {
    expect(resolveHomeForRole(null)).toBe('/login');
  });
});

describe('isRoleAllowed', () => {
  it('admin can access admin-only route', () => {
    expect(isRoleAllowed('admin', ['admin'])).toBe(true);
  });
  it('admin can access workspace route (admin always allowed in workspace)', () => {
    expect(isRoleAllowed('admin', ['staff', 'admin'])).toBe(true);
  });
  it('staff cannot access admin route', () => {
    expect(isRoleAllowed('staff', ['admin'])).toBe(false);
  });
  it('client cannot access workspace', () => {
    expect(isRoleAllowed('client', ['staff', 'admin'])).toBe(false);
  });
  it('null role is denied everywhere', () => {
    expect(isRoleAllowed(null, ['admin'])).toBe(false);
    expect(isRoleAllowed(null, ['staff', 'admin'])).toBe(false);
    expect(isRoleAllowed(null, ['client'])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

```powershell
npm test -- tests/auth/require-role.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `require-role.ts`**

Create `src/lib/auth/require-role.ts`:

```ts
export type AppRole = 'admin' | 'staff' | 'client';

export function resolveHomeForRole(role: AppRole | null): string {
  if (role === 'admin') return '/admin';
  if (role === 'staff') return '/workspace';
  if (role === 'client') return '/portal';
  return '/login';
}

export function isRoleAllowed(
  role: AppRole | null,
  allowed: AppRole[],
): boolean {
  if (role === null) return false;
  return allowed.includes(role);
}
```

- [ ] **Step 4: Run tests, confirm pass**

```powershell
npm test -- tests/auth/require-role.test.ts
```

Expected: 9 tests pass.

- [ ] **Step 5: Implement `get-current-profile.ts`**

Create `src/lib/auth/get-current-profile.ts`:

```ts
import { createClient } from '@/lib/supabase/server';
import type { AppRole } from './require-role';

export type CurrentProfile = {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_id, email, full_name, role')
    .eq('user_id', user.id)
    .single();

  if (error || !profile) return null;

  return {
    userId: profile.user_id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as AppRole,
  };
}
```

- [ ] **Step 6: Verify build**

```powershell
npm run build
```

- [ ] **Step 7: Commit**

```powershell
git add src/lib/auth tests/auth
git commit -m "feat(auth): add getCurrentProfile and role guard helpers"
```

---

## Task 11: Middleware — role-based route gating

**Files:**
- Create or modify: `src/middleware.ts`
- Create: `tests/middleware/role-routing.test.ts`

springboard-mis may already have a middleware for Supabase session refresh. We extend it to also gate routes by role.

- [ ] **Step 1: Write the failing test for the route-classification helper**

We'll factor the role-routing decision into a pure function so it's testable without the Next request object.

Create `tests/middleware/role-routing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { decideRedirect } from '@/lib/auth/decide-redirect';

describe('decideRedirect', () => {
  it('unauthenticated user on protected route → /login', () => {
    expect(decideRedirect({ pathname: '/admin', role: null })).toBe('/login');
    expect(decideRedirect({ pathname: '/workspace', role: null })).toBe('/login');
    expect(decideRedirect({ pathname: '/portal', role: null })).toBe('/login');
  });

  it('unauthenticated on /login or / passes through', () => {
    expect(decideRedirect({ pathname: '/login', role: null })).toBeNull();
    expect(decideRedirect({ pathname: '/', role: null })).toBeNull();
  });

  it('authenticated user on / is sent to their home', () => {
    expect(decideRedirect({ pathname: '/', role: 'admin' })).toBe('/admin');
    expect(decideRedirect({ pathname: '/', role: 'staff' })).toBe('/workspace');
    expect(decideRedirect({ pathname: '/', role: 'client' })).toBe('/portal');
  });

  it('client on /admin or /workspace → /portal', () => {
    expect(decideRedirect({ pathname: '/admin', role: 'client' })).toBe('/portal');
    expect(decideRedirect({ pathname: '/workspace', role: 'client' })).toBe('/portal');
  });

  it('staff on /admin → /workspace', () => {
    expect(decideRedirect({ pathname: '/admin', role: 'staff' })).toBe('/workspace');
  });

  it('staff on /portal → /workspace', () => {
    expect(decideRedirect({ pathname: '/portal', role: 'staff' })).toBe('/workspace');
  });

  it('admin can access any surface (no redirect)', () => {
    expect(decideRedirect({ pathname: '/admin', role: 'admin' })).toBeNull();
    expect(decideRedirect({ pathname: '/workspace', role: 'admin' })).toBeNull();
    expect(decideRedirect({ pathname: '/portal', role: 'admin' })).toBeNull();
  });

  it('user on their own surface passes through', () => {
    expect(decideRedirect({ pathname: '/workspace/projects/abc', role: 'staff' })).toBeNull();
    expect(decideRedirect({ pathname: '/portal/projects/abc', role: 'client' })).toBeNull();
  });

  it('authenticated user on /login is sent to their home', () => {
    expect(decideRedirect({ pathname: '/login', role: 'admin' })).toBe('/admin');
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```powershell
npm test -- tests/middleware/role-routing.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `decideRedirect`**

Create `src/lib/auth/decide-redirect.ts`:

```ts
import type { AppRole } from './require-role';

type Input = {
  pathname: string;
  role: AppRole | null;
};

const PUBLIC_PATHS = new Set(['/', '/login', '/forgot-password', '/reset-password']);

function surfaceFor(pathname: string): 'admin' | 'workspace' | 'portal' | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/workspace' || pathname.startsWith('/workspace/')) return 'workspace';
  if (pathname === '/portal' || pathname.startsWith('/portal/')) return 'portal';
  return null;
}

export function decideRedirect({ pathname, role }: Input): string | null {
  const surface = surfaceFor(pathname);

  // Unauthenticated
  if (role === null) {
    if (surface !== null) return '/login';
    return null;
  }

  // Authenticated
  const home =
    role === 'admin' ? '/admin' :
    role === 'staff' ? '/workspace' :
    /* client */       '/portal';

  // Root or login → bounce to home
  if (pathname === '/' || pathname === '/login') return home;

  // Admin can go anywhere
  if (role === 'admin') return null;

  // Otherwise must match own surface
  if (surface === null) return null; // /account, etc.
  if (
    (role === 'staff'  && surface !== 'workspace') ||
    (role === 'client' && surface !== 'portal')
  ) return home;

  return null;
}
```

- [ ] **Step 4: Run tests, confirm pass**

```powershell
npm test -- tests/middleware/role-routing.test.ts
```

Expected: 9 tests pass.

- [ ] **Step 5: Wire `decideRedirect` into `src/middleware.ts`**

Read the existing `src/middleware.ts` (likely refreshes the Supabase session). Replace or extend it with:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { decideRedirect } from '@/lib/auth/decide-redirect';
import type { Database } from '@/lib/supabase/types';
import type { AppRole } from '@/lib/auth/require-role';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  let role: AppRole | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    role = (profile?.role as AppRole | undefined) ?? null;
  }

  const redirectTo = decideRedirect({
    pathname: request.nextUrl.pathname,
    role,
  });

  if (redirectTo) {
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 6: Build and confirm green**

```powershell
npm run build
```

- [ ] **Step 7: Commit**

```powershell
git add src/middleware.ts src/lib/auth/decide-redirect.ts tests/middleware
git commit -m "feat(auth): add role-based route middleware"
```

---

## Task 12: Empty role-home pages

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/app/workspace/page.tsx`
- Create: `src/app/portal/page.tsx`
- Modify: `src/app/page.tsx` (root redirect)

These are placeholder shells — Plans 2-4 fill them in.

- [ ] **Step 1: Create `src/app/admin/page.tsx`**

```tsx
import { getCurrentProfile } from '@/lib/auth/get-current-profile';

export default async function AdminHome() {
  const profile = await getCurrentProfile();
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">DC&A Hub PMS — Admin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {profile?.fullName ?? 'unknown'} ({profile?.email}).
      </p>
      <p className="mt-4">Admin console coming in Plan 2.</p>
    </main>
  );
}
```

- [ ] **Step 2: Create `src/app/workspace/page.tsx`**

```tsx
import { getCurrentProfile } from '@/lib/auth/get-current-profile';

export default async function WorkspaceHome() {
  const profile = await getCurrentProfile();
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">DC&A Hub PMS — Workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {profile?.fullName ?? 'unknown'} ({profile?.email}).
      </p>
      <p className="mt-4">Workspace coming in Plan 3.</p>
    </main>
  );
}
```

- [ ] **Step 3: Create `src/app/portal/page.tsx`**

```tsx
import { getCurrentProfile } from '@/lib/auth/get-current-profile';

export default async function PortalHome() {
  const profile = await getCurrentProfile();
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">DC&A Hub PMS — Client Portal</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {profile?.fullName ?? 'unknown'} ({profile?.email}).
      </p>
      <p className="mt-4">Project view coming in Plan 4.</p>
    </main>
  );
}
```

- [ ] **Step 4: Update `src/app/page.tsx` to be a thin pass-through**

Middleware already redirects authenticated users away from `/`, so this only renders for unauthenticated users hitting the root. Make it a small marketing/landing stub:

```tsx
import Link from 'next/link';

export default function RootPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-semibold">DC&A Hub PMS</h1>
      <p className="mt-4">Project Management System for DC&A Hub.</p>
      <p className="mt-6">
        <Link className="underline" href="/login">Sign in</Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Build**

```powershell
npm run build
```

- [ ] **Step 6: Commit**

```powershell
git add src/app
git commit -m "feat: add empty role-home shells and root landing"
```

---

## Task 13: Login flow

springboard-mis has a `/login` page already. We verify it works against the new Supabase project and adapt the post-login redirect to use the role-home logic.

**Files:**
- Read/modify: `src/app/(auth)/login/page.tsx` or wherever the login page lives
- Read/modify: any login server action

- [ ] **Step 1: Locate the login page**

```powershell
Get-ChildItem -Recurse src\app -Filter "page.tsx" | Select-String -Pattern "supabase\.auth" -List
```

Or grep for `signInWithPassword`. Note the file path.

- [ ] **Step 2: Verify the form posts email + password to Supabase**

Open the file. It likely calls `supabase.auth.signInWithPassword({ email, password })`. If it then redirects with `redirect('/dashboard')` or similar, change that to redirect to `/` — middleware will bounce to the correct role-home automatically.

Snippet to use after successful sign-in:

```ts
import { redirect } from 'next/navigation';
// ...
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) return { error: error.message };
redirect('/');
```

- [ ] **Step 3: Update the login page heading**

Replace any "Springboard"/"SRSF" text in the login UI with "DC&A Hub PMS".

- [ ] **Step 4: Build**

```powershell
npm run build
```

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat(auth): rebrand login and route post-login through role middleware"
```

---

## Task 14: Seed first admin user

**Files:**
- Create: `supabase/seed.sql`
- Create: `scripts/seed-admin.ts`
- Modify: `package.json` (script)

We can't insert into `auth.users` from regular SQL safely — use the Supabase admin API via a Node script.

- [ ] **Step 1: Add `@supabase/supabase-js` admin usage script**

Create `scripts/seed-admin.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL!;
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Admin';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD!;

if (!SUPABASE_URL || !SERVICE_ROLE || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Missing one of: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Create or fetch the auth user (idempotent-ish — if it exists, the create call errors and we look it up).
  let userId: string;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });

  if (createErr && !createErr.message.toLowerCase().includes('already')) {
    console.error('createUser failed:', createErr);
    process.exit(1);
  }

  if (created?.user) {
    userId = created.user.id;
  } else {
    const { data: list } = await admin.auth.admin.listUsers();
    const found = list.users.find((u) => u.email === ADMIN_EMAIL);
    if (!found) { console.error('User not found after create attempt.'); process.exit(1); }
    userId = found.id;
  }

  // Upsert the profile row with role=admin.
  const { error: upsertErr } = await admin.from('profiles').upsert({
    user_id: userId,
    email: ADMIN_EMAIL,
    full_name: ADMIN_NAME,
    role: 'admin',
  }, { onConflict: 'user_id' });

  if (upsertErr) {
    console.error('profile upsert failed:', upsertErr);
    process.exit(1);
  }

  console.log(`Seeded admin: ${ADMIN_EMAIL} (${userId})`);
}

main();
```

- [ ] **Step 2: Add a script entry in `package.json`**

```json
"seed:admin": "tsx scripts/seed-admin.ts"
```

- [ ] **Step 3: Install `tsx` if not present**

```powershell
npm install -D tsx
```

- [ ] **Step 4: Document required env vars in `.env.local.example`**

Append to `.env.local.example`:

```env
# Seed
SEED_ADMIN_EMAIL=
SEED_ADMIN_NAME=
SEED_ADMIN_PASSWORD=
```

- [ ] **Step 5: Run the seed (with values set in `.env.local`)**

Set the three SEED_* env vars in `.env.local`, then:

```powershell
$env:SEED_ADMIN_EMAIL = "kgyebi112@gmail.com"
$env:SEED_ADMIN_NAME  = "Ishmael Kojo Gyebi"
$env:SEED_ADMIN_PASSWORD = "<a strong password you choose>"
$env:NEXT_PUBLIC_SUPABASE_URL = (Get-Content .env.local | Select-String "NEXT_PUBLIC_SUPABASE_URL=").Line.Split("=",2)[1]
$env:SUPABASE_SERVICE_ROLE_KEY = (Get-Content .env.local | Select-String "SUPABASE_SERVICE_ROLE_KEY=").Line.Split("=",2)[1]
npm run seed:admin
```

Expected output: `Seeded admin: kgyebi112@gmail.com (<uuid>)`.

Verify in Supabase dashboard → Authentication → Users that the user exists, and Table Editor → `profiles` shows a row with `role='admin'`.

- [ ] **Step 6: Commit**

```powershell
git add scripts/seed-admin.ts package.json package-lock.json .env.local.example
git commit -m "chore: add seed script for first admin user"
```

---

## Task 15: RLS integration test

**Files:**
- Create: `tests/rls/rls.test.ts`
- Create: `tests/rls/setup.ts`

This test creates two test users (one staff member of project A, one client viewer of project B), inserts seed rows, and asserts each can read only what they should.

- [ ] **Step 1: Write the setup helper**

Create `tests/rls/setup.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createTestUser(role: 'admin' | 'staff' | 'client', email: string) {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'TestPass!23',
    email_confirm: true,
  });
  if (error && !error.message.toLowerCase().includes('already')) throw error;

  let userId = data?.user?.id;
  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers();
    userId = list.users.find((u) => u.email === email)!.id;
  }

  await admin.from('profiles').upsert({
    user_id: userId,
    email,
    full_name: email,
    role,
  }, { onConflict: 'user_id' });

  return userId!;
}

export async function clientAs(email: string): Promise<SupabaseClient<Database>> {
  const sb = createClient<Database>(URL, ANON);
  const { error } = await sb.auth.signInWithPassword({ email, password: 'TestPass!23' });
  if (error) throw error;
  return sb;
}
```

- [ ] **Step 2: Write the RLS test**

Create `tests/rls/rls.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { adminClient, createTestUser, clientAs } from './setup';

const STAFF_A = 'rlstest-staff-a@example.com';
const CLIENT_A = 'rlstest-client-a@example.com';
const CLIENT_B = 'rlstest-client-b@example.com';

let projectA: string;
let projectB: string;

beforeAll(async () => {
  const admin = adminClient();

  // Users
  const staffA  = await createTestUser('staff',  STAFF_A);
  const clientA = await createTestUser('client', CLIENT_A);
  const clientB = await createTestUser('client', CLIENT_B);

  // Two clients (orgs)
  const { data: orgA } = await admin.from('clients').upsert({ name: 'Org A' }, { onConflict: 'name' }).select().single();
  const { data: orgB } = await admin.from('clients').upsert({ name: 'Org B' }, { onConflict: 'name' }).select().single();

  // Two projects
  const { data: pA } = await admin.from('projects').upsert({ name: 'Project A', code: 'RLSA', client_id: orgA!.id }, { onConflict: 'code' }).select().single();
  const { data: pB } = await admin.from('projects').upsert({ name: 'Project B', code: 'RLSB', client_id: orgB!.id }, { onConflict: 'code' }).select().single();
  projectA = pA!.id;
  projectB = pB!.id;

  // Memberships
  await admin.from('project_members').upsert([
    { project_id: projectA, user_id: staffA,   project_role: 'member' },
    { project_id: projectA, user_id: clientA,  project_role: 'viewer' },
    { project_id: projectB, user_id: clientB,  project_role: 'viewer' },
  ], { onConflict: 'project_id,user_id' });
}, 60_000);

describe('RLS — projects', () => {
  it('client A sees project A but not project B', async () => {
    const sb = await clientAs(CLIENT_A);
    const { data } = await sb.from('projects').select('id, code');
    const codes = (data ?? []).map((p) => p.code);
    expect(codes).toContain('RLSA');
    expect(codes).not.toContain('RLSB');
  });

  it('client B sees project B but not project A', async () => {
    const sb = await clientAs(CLIENT_B);
    const { data } = await sb.from('projects').select('id, code');
    const codes = (data ?? []).map((p) => p.code);
    expect(codes).toContain('RLSB');
    expect(codes).not.toContain('RLSA');
  });

  it('client cannot insert a project', async () => {
    const sb = await clientAs(CLIENT_A);
    const { error } = await sb.from('projects').insert({
      name: 'evil', code: 'EVIL', client_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).not.toBeNull();
  });

  it('staff member of project A can update its description', async () => {
    const sb = await clientAs(STAFF_A);
    const { error } = await sb.from('projects').update({ description: 'updated by staff' }).eq('id', projectA);
    expect(error).toBeNull();
  });
});
```

- [ ] **Step 3: Run the RLS test**

```powershell
npm run test:rls
```

Expected: 4 tests pass. (This hits the live Supabase project — the seeded test users will remain. They're harmless and idempotent.)

If a test fails, the policies in `0002_rls_policies.sql` need adjustment. Common issues:
- Missing `using` or `with check` clause
- Forgot to include `is_admin()` bypass
- A `select` inside a policy that itself triggers RLS — wrap helpers as `security definer`

- [ ] **Step 4: Commit**

```powershell
git add tests/rls
git commit -m "test: RLS isolation between clients verified"
```

---

## Task 16: Deploy to Vercel

**Files:** none (Vercel dashboard).

- [ ] **Step 1: Create a Vercel project**

In Vercel dashboard → New Project → Import from GitHub (push the local repo to a new GitHub repo first if needed).

- [ ] **Step 2: Set env vars on Vercel**

Project Settings → Environment Variables. Add the same keys as `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_NAME=DC&A Hub PMS`
- `NEXT_PUBLIC_APP_URL=https://<vercel-default-domain>`

- [ ] **Step 3: Trigger deploy**

Push `main`. Vercel auto-deploys.

- [ ] **Step 4: Smoke test the deployed site**

1. Open the Vercel URL → see the landing page.
2. Click Sign in → log in as the seeded admin.
3. Confirm you land on `/admin` with the placeholder shell.
4. Try visiting `/portal` → confirm you're bounced back to `/admin` (admin can access everything, but the redirect from `/login` should hit `/admin` first; navigating manually to `/portal` is allowed for admin).

- [ ] **Step 5: Tag the release**

```powershell
git tag v0.1.0-foundation
git push origin v0.1.0-foundation
```

---

## Verification (end of plan)

After all tasks:

1. `npm run build` succeeds.
2. `npm test` — all unit tests pass.
3. `npm run test:rls` — RLS tests pass.
4. Deployed site: admin can log in and reach `/admin`. Unauthenticated users hitting `/admin`/`/workspace`/`/portal` are bounced to `/login`.
5. The seeded admin is the only user with `role='admin'`.

After this plan ships, **Plan 2 (Admin Console)** picks up by adding the clients/projects/users CRUD inside `/admin/*`.

---

## Self-Review Notes

- **Spec coverage:** Sections 1, 2, 3, 4, 5 (data model + RLS), 6 (only the role-routing skeleton — actual page contents come in Plans 2-4), 10 (migrations + seed) are covered. Section 7 (flows), 8 (email), 9 (out of scope), 11 (open items), 12 (success criteria) belong to later plans or are documentation-only.
- **Naming consistency:** `member|viewer` for `project_members.project_role`, `admin|staff|client` for `profiles.role`, used consistently across SQL, helpers, middleware, and tests.
- **Placeholder check:** No "TBD"/"TODO" — every code block is complete.
- **Non-blocking gaps for foundation:** custom domain, Resend key, brand colours — all explicitly in spec section 11 as deferred.
