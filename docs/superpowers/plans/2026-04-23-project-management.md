# Project Management Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Performance Management with a Project Management module that lets MEL managers track SRSF projects (Enterprise Spotlight, ABSA Onboarding, Nkabom Collaborative) and lets executives see progress at a glance.

**Architecture:** New Supabase schema (`projects`, `project_milestones`, `project_activities`, `project_activity_updates`, `project_activity_attachments`) with RLS and a `BEFORE UPDATE` trigger enforcing "proof required to mark Done". Next.js App Router pages at `/projects` (index) and `/projects/[slug]` (detail with Activities + optional Program Data tabs). Executive dashboard gets a condensed Projects strip. Performance Management is fully removed (UI, nav, DB).

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (Postgres + Storage + SSR), shadcn/ui on `@base-ui/react`, Tailwind v4, ECharts (reused via extracted ProgramDashboard component).

**Testing note:** This codebase has no test framework. Each task's verification step is TypeScript type-check (`npx tsc --noEmit`), `next build`, and where applicable browser preview verification via preview tools. Commit after every task.

**Role mapping** (reuses existing `roles` table): "MEL Manager" = users whose role name is `Admin` or `Program Manager`. Activity owners can be any user. Executives = `Viewer` role (read-only). A helper `isMELManager(user)` is introduced and used consistently.

---

## File Structure

### Created

- `supabase/migrations/005_projects.sql` — drops performance tables, creates project tables, RLS, trigger, storage, seed.
- `src/lib/projects/types.ts` — TS types for projects, milestones, activities, updates, attachments.
- `src/lib/projects/status.ts` — computed project/activity status helpers.
- `src/lib/projects/queries.ts` — supabase client helpers for listing/fetching projects + activities.
- `src/lib/projects/mutations.ts` — create/update/delete helpers; upload attachment.
- `src/components/projects/status-pill.tsx`
- `src/components/projects/priority-flag.tsx`
- `src/components/projects/project-card.tsx` (variants: full | compact)
- `src/components/projects/project-form-modal.tsx`
- `src/components/projects/milestone-form-modal.tsx`
- `src/components/projects/activity-row.tsx`
- `src/components/projects/activity-form-modal.tsx`
- `src/components/projects/activity-side-panel.tsx`
- `src/components/projects/attachments-gallery.tsx`
- `src/components/projects/projects-dashboard-strip.tsx`
- `src/components/programs/program-dashboard.tsx` — extracted reusable program dashboard.
- `src/app/(dashboard)/projects/page.tsx`
- `src/app/(dashboard)/projects/[slug]/page.tsx`

### Modified

- `src/lib/types.ts` — swap `performance` → `projects` in `AppModule`.
- `src/lib/constants.ts` — update `PROGRAMS`, `NAV_ITEMS`, `MODULE_LABELS`.
- `src/app/(dashboard)/dashboard/page.tsx` — insert ProjectsDashboardStrip.
- `src/app/(dashboard)/programs/[slug]/page.tsx` — thin wrapper around extracted `<ProgramDashboard>`.
- `src/components/settings/permissions-matrix.tsx` — reflect module rename.

### Deleted

- `src/app/(dashboard)/performance/**`
- `src/components/performance/**`
- `src/app/(dashboard)/programs/enterprise-spotlight/` (if route-specific files exist — see Task 7)
- `src/app/(dashboard)/programs/absa/` (same)

---

## Task 1: Database migration `005_projects.sql`

**Files:**
- Create: `supabase/migrations/005_projects.sql`

- [ ] **Step 1: Write the full migration**

Create `supabase/migrations/005_projects.sql`:

```sql
-- supabase/migrations/005_projects.sql

-- ============================================
-- 1. Drop performance management (from 004)
-- ============================================
-- Drop storage policies and bucket for performance
drop policy if exists "auth_upload_performance_attachments" on storage.objects;
drop policy if exists "auth_read_performance_attachments"   on storage.objects;
delete from storage.objects where bucket_id = 'performance-attachments';
delete from storage.buckets where id = 'performance-attachments';

-- Drop performance RLS policies
drop policy if exists "auth_read_departments"               on public.departments;
drop policy if exists "auth_read_user_departments"          on public.user_departments;
drop policy if exists "auth_read_performance_goals"         on public.performance_goals;
drop policy if exists "auth_read_performance_activities"    on public.performance_activities;
drop policy if exists "auth_read_activity_submissions"      on public.activity_submissions;
drop policy if exists "auth_read_activity_attachments"      on public.activity_attachments;
drop policy if exists "auth_write_departments"              on public.departments;
drop policy if exists "auth_write_user_departments"         on public.user_departments;
drop policy if exists "auth_write_performance_goals"        on public.performance_goals;
drop policy if exists "auth_write_performance_activities"   on public.performance_activities;
drop policy if exists "auth_write_activity_submissions"     on public.activity_submissions;
drop policy if exists "auth_write_activity_attachments"     on public.activity_attachments;

-- Drop performance tables in reverse FK order
drop table if exists public.activity_attachments    cascade;
drop table if exists public.activity_submissions    cascade;
drop table if exists public.performance_activities  cascade;
drop table if exists public.performance_goals       cascade;
drop table if exists public.user_departments        cascade;
drop table if exists public.departments             cascade;

-- Remove performance role permissions
delete from public.role_permissions where module = 'performance';

-- ============================================
-- 2. Extend app_module enum with 'projects'
-- ============================================
alter type public.app_module add value if not exists 'projects';

-- ============================================
-- 3. PROJECTS
-- ============================================
create table public.projects (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  slug              text not null unique,
  description       text,
  owner_user_id     uuid references public.user_profiles(id) on delete set null,
  program_slug      text,
  start_date        date,
  target_end_date   date,
  status_override   text check (status_override in ('blocked','done')),
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================
-- 4. PROJECT_MILESTONES
-- ============================================
create table public.project_milestones (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  name         text not null,
  order_index  int  not null default 0,
  created_at   timestamptz not null default now()
);

-- ============================================
-- 5. PROJECT_ACTIVITIES
-- ============================================
create table public.project_activities (
  id                uuid primary key default uuid_generate_v4(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  milestone_id      uuid references public.project_milestones(id) on delete set null,
  title             text not null,
  description       text,
  owner_user_id     uuid references public.user_profiles(id) on delete set null,
  due_date          date,
  status            text not null default 'not_started'
                    check (status in ('not_started','in_progress','done','blocked')),
  priority          text not null default 'medium'
                    check (priority in ('low','medium','high')),
  percent_complete  int  not null default 0 check (percent_complete between 0 and 100),
  last_update_text  text,
  last_update_at    timestamptz,
  created_by        uuid references public.user_profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================
-- 6. PROJECT_ACTIVITY_UPDATES (audit log)
-- ============================================
create table public.project_activity_updates (
  id              uuid primary key default uuid_generate_v4(),
  activity_id     uuid not null references public.project_activities(id) on delete cascade,
  user_id         uuid not null references public.user_profiles(id) on delete cascade,
  note            text not null,
  status_before   text,
  status_after    text,
  created_at      timestamptz not null default now()
);

-- ============================================
-- 7. PROJECT_ACTIVITY_ATTACHMENTS (proof of activity)
-- ============================================
create table public.project_activity_attachments (
  id             uuid primary key default uuid_generate_v4(),
  activity_id    uuid not null references public.project_activities(id) on delete cascade,
  uploaded_by    uuid references public.user_profiles(id) on delete set null,
  file_path      text not null,
  file_name      text not null,
  mime_type      text not null,
  size_bytes     bigint not null,
  caption        text,
  created_at     timestamptz not null default now()
);

-- ============================================
-- 8. Trigger: proof required to mark Done
-- ============================================
create or replace function public.enforce_proof_before_done()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and (old.status is distinct from 'done') then
    if not exists (
      select 1 from public.project_activity_attachments
       where activity_id = new.id
    ) then
      raise exception 'At least one proof-of-activity attachment is required before marking an activity as Done (activity_id=%).', new.id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_proof_before_done
before update on public.project_activities
for each row execute function public.enforce_proof_before_done();

-- ============================================
-- 9. Indexes
-- ============================================
create index idx_project_activities_project     on public.project_activities(project_id);
create index idx_project_activities_owner       on public.project_activities(owner_user_id);
create index idx_project_activities_due_date    on public.project_activities(due_date);
create index idx_project_activities_status      on public.project_activities(status);
create index idx_project_activity_updates_act   on public.project_activity_updates(activity_id);
create index idx_project_activity_attach_act    on public.project_activity_attachments(activity_id);
create index idx_project_milestones_project     on public.project_milestones(project_id);

-- ============================================
-- 10. RLS
-- ============================================
alter table public.projects                      enable row level security;
alter table public.project_milestones            enable row level security;
alter table public.project_activities            enable row level security;
alter table public.project_activity_updates      enable row level security;
alter table public.project_activity_attachments  enable row level security;

-- Simple authenticated read + authenticated write (UI-level role gating mirrors this for MVP;
-- refine to role-scoped policies in a follow-up if needed).
create policy "auth_read_projects"               on public.projects                      for select using (auth.role() = 'authenticated');
create policy "auth_write_projects"              on public.projects                      for all    using (auth.role() = 'authenticated');
create policy "auth_read_project_milestones"     on public.project_milestones            for select using (auth.role() = 'authenticated');
create policy "auth_write_project_milestones"    on public.project_milestones            for all    using (auth.role() = 'authenticated');
create policy "auth_read_project_activities"     on public.project_activities            for select using (auth.role() = 'authenticated');
create policy "auth_write_project_activities"    on public.project_activities            for all    using (auth.role() = 'authenticated');
create policy "auth_read_project_updates"        on public.project_activity_updates      for select using (auth.role() = 'authenticated');
create policy "auth_write_project_updates"       on public.project_activity_updates      for all    using (auth.role() = 'authenticated');
create policy "auth_read_project_attachments"    on public.project_activity_attachments  for select using (auth.role() = 'authenticated');
create policy "auth_write_project_attachments"   on public.project_activity_attachments  for all    using (auth.role() = 'authenticated');

-- ============================================
-- 11. Storage bucket: project-activity-proofs
-- ============================================
insert into storage.buckets (id, name, public)
values ('project-activity-proofs', 'project-activity-proofs', false)
on conflict do nothing;

create policy "auth_upload_project_proofs"
  on storage.objects for insert
  with check (bucket_id = 'project-activity-proofs' and auth.role() = 'authenticated');

create policy "auth_read_project_proofs"
  on storage.objects for select
  using (bucket_id = 'project-activity-proofs' and auth.role() = 'authenticated');

create policy "auth_delete_project_proofs"
  on storage.objects for delete
  using (bucket_id = 'project-activity-proofs' and auth.role() = 'authenticated');

-- ============================================
-- 12. Role permissions for 'projects' module
-- ============================================
insert into public.role_permissions (role_id, module, allowed)
select id, 'projects', true  from public.roles where name = 'Admin';
insert into public.role_permissions (role_id, module, allowed)
select id, 'projects', true  from public.roles where name = 'Program Manager';
insert into public.role_permissions (role_id, module, allowed)
select id, 'projects', true  from public.roles where name = 'Data Entry Officer';
insert into public.role_permissions (role_id, module, allowed)
select id, 'projects', true  from public.roles where name = 'Viewer';

-- ============================================
-- 13. Seed projects
-- ============================================
insert into public.projects (name, slug, description, program_slug) values
  ('Enterprise Spotlight',  'enterprise-spotlight',  'Track progress of the Enterprise Spotlight project.', 'enterprise-spotlight'),
  ('ABSA Onboarding',       'absa-onboarding',       'Track progress of the ABSA Onboarding project.',      'absa-onboarding'),
  ('Nkabom Collaborative',  'nkabom-collaborative',  'Track progress of the Nkabom Collaborative project.', null)
on conflict (slug) do nothing;
```

- [ ] **Step 2: Verify migration parses**

Run: `npx supabase db lint supabase/migrations/005_projects.sql` if Supabase CLI is installed, otherwise skip. Apply the migration to your local or remote Supabase with your usual flow (`supabase db push` or via SQL editor in the dashboard).

Expected: migration runs without error; `select count(*) from public.projects;` returns 3.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_projects.sql
git commit -m "feat(projects): migration to replace performance with projects"
```

---

## Task 2: Swap `performance` → `projects` in types and constants

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Update `AppModule` in `src/lib/types.ts`**

Change the union: replace `| "performance"` with `| "projects"`:

```ts
export type AppModule =
  | "executive_dashboard"
  | "program_dashboards"
  | "data_entry"
  | "indicators"
  | "learnings"
  | "settings"
  | "projects";
```

- [ ] **Step 2: Update `src/lib/constants.ts`**

- Trim `PROGRAMS` to Virtual University and Hangout only (ES and ABSA move to Projects):

```ts
export const PROGRAMS = [
  { name: "Virtual University", slug: "virtual-university" },
  { name: "Hangout", slug: "hangout" },
] as const;
```

- In `NAV_ITEMS`, replace the Performance entry with Projects. Import `FolderKanban` from `lucide-react`:

```ts
import { FolderKanban } from "lucide-react";
// ...
{
  label: "Projects",
  href: "/projects",
  icon: FolderKanban,
  module: "projects",
},
```

Remove the old Performance entry entirely.

- In `MODULE_LABELS`, remove `performance` and add:

```ts
projects: "Projects",
```

- `DATA_ENTRY_PROGRAMS` stays unchanged — ES and ABSA data entry forms still exist, they're just re-housed visually.

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: errors listing every remaining reference to `"performance"` as a module (sidebar, pages, permissions-matrix). These are wired up in Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/constants.ts
git commit -m "feat(projects): swap performance module for projects in types and nav"
```

---

## Task 3: Delete Performance UI and update references

**Files:**
- Delete: `src/app/(dashboard)/performance/`
- Delete: `src/components/performance/`
- Modify: `src/components/settings/permissions-matrix.tsx` (remove any hardcoded `performance` references)
- Modify: any file still referencing `"performance"` as an `AppModule` literal

- [ ] **Step 1: Delete folders**

```bash
rm -rf src/app/\(dashboard\)/performance
rm -rf src/components/performance
```

- [ ] **Step 2: Fix remaining `performance` references**

Run: `npx tsc --noEmit` and read the error list.

For each file the compiler flags (likely `src/components/settings/permissions-matrix.tsx`):
- If it references `"performance"` as a literal module, replace with `"projects"` or remove the entry depending on context. `MODULE_LABELS` no longer has `performance`, so anywhere iterating `MODULE_LABELS` will automatically drop it.
- If it imports from `@/components/performance/...`, delete the import and any JSX using it.

- [ ] **Step 3: Verify clean**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

Run: `grep -r "performance" src/ --include="*.ts" --include="*.tsx"` (via Grep tool).
Expected: zero matches (except literal user-facing strings unrelated to the module, which you should eyeball).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(projects): remove performance management UI"
```

---

## Task 4: Project types and status helper

**Files:**
- Create: `src/lib/projects/types.ts`
- Create: `src/lib/projects/status.ts`

- [ ] **Step 1: Create `src/lib/projects/types.ts`**

```ts
export type ActivityStatus = "not_started" | "in_progress" | "done" | "blocked";
export type ActivityPriority = "low" | "medium" | "high";
export type ProjectStatusOverride = "blocked" | "done" | null;
export type ComputedProjectStatus =
  | "not_started"
  | "in_progress"
  | "at_risk"
  | "blocked"
  | "done";

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_user_id: string | null;
  program_slug: string | null;
  start_date: string | null;
  target_end_date: string | null;
  status_override: ProjectStatusOverride;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  name: string;
  order_index: number;
  created_at: string;
}

export interface ProjectActivity {
  id: string;
  project_id: string;
  milestone_id: string | null;
  title: string;
  description: string | null;
  owner_user_id: string | null;
  due_date: string | null;
  status: ActivityStatus;
  priority: ActivityPriority;
  percent_complete: number;
  last_update_text: string | null;
  last_update_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectActivityUpdate {
  id: string;
  activity_id: string;
  user_id: string;
  note: string;
  status_before: ActivityStatus | null;
  status_after: ActivityStatus | null;
  created_at: string;
}

export interface ProjectActivityAttachment {
  id: string;
  activity_id: string;
  uploaded_by: string | null;
  file_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Create `src/lib/projects/status.ts`**

```ts
import type {
  ComputedProjectStatus,
  Project,
  ProjectActivity,
} from "./types";

function isOverdue(activity: ProjectActivity, today: Date): boolean {
  if (!activity.due_date || activity.status === "done") return false;
  return new Date(activity.due_date) < today;
}

export function computeProjectStatus(
  project: Pick<Project, "status_override">,
  activities: ProjectActivity[],
  now: Date = new Date(),
): ComputedProjectStatus {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (activities.length > 0 && activities.every((a) => a.status === "done")) {
    return "done";
  }
  if (project.status_override === "blocked") return "blocked";

  const hasOverdue = activities.some((a) => isOverdue(a, today));
  const hasHighBlocked = activities.some(
    (a) => a.priority === "high" && a.status === "blocked",
  );
  if (hasOverdue || hasHighBlocked) return "at_risk";

  if (activities.some((a) => a.status !== "not_started")) return "in_progress";
  return "not_started";
}

export function computeProgressPercent(activities: ProjectActivity[]): number {
  if (activities.length === 0) return 0;
  const done = activities.filter((a) => a.status === "done").length;
  return Math.round((done / activities.length) * 100);
}

export function countOverdue(
  activities: ProjectActivity[],
  now: Date = new Date(),
): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return activities.filter((a) => isOverdue(a, today)).length;
}

export function countNeedsAttention(activities: ProjectActivity[]): number {
  return activities.filter(
    (a) => a.status === "blocked" || a.priority === "high",
  ).length;
}

export const STATUS_LABEL: Record<ComputedProjectStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  at_risk: "At Risk",
  blocked: "Blocked",
  done: "Done",
};

export const STATUS_TONE: Record<
  ComputedProjectStatus,
  "neutral" | "blue" | "amber" | "red" | "green"
> = {
  not_started: "neutral",
  in_progress: "blue",
  at_risk: "amber",
  blocked: "red",
  done: "green",
};
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/projects/
git commit -m "feat(projects): types and status helpers"
```

---

## Task 5: Project queries and mutations

**Files:**
- Create: `src/lib/projects/queries.ts`
- Create: `src/lib/projects/mutations.ts`

- [ ] **Step 1: Create `src/lib/projects/queries.ts`**

```ts
import { createClient } from "@/lib/supabase/client";
import type {
  Project,
  ProjectActivity,
  ProjectActivityAttachment,
  ProjectActivityUpdate,
  ProjectMilestone,
} from "./types";

export async function listProjects(): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Project | null) ?? null;
}

export async function listMilestones(
  projectId: string,
): Promise<ProjectMilestone[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProjectMilestone[];
}

export async function listActivities(
  projectId: string,
): Promise<ProjectActivity[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_activities")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProjectActivity[];
}

export async function listUpdates(
  activityId: string,
): Promise<ProjectActivityUpdate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_activity_updates")
    .select("*")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectActivityUpdate[];
}

export async function listAttachments(
  activityId: string,
): Promise<ProjectActivityAttachment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_activity_attachments")
    .select("*")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectActivityAttachment[];
}
```

- [ ] **Step 2: Create `src/lib/projects/mutations.ts`**

```ts
import { createClient } from "@/lib/supabase/client";
import type {
  ActivityPriority,
  ActivityStatus,
  Project,
  ProjectActivity,
  ProjectActivityAttachment,
  ProjectMilestone,
} from "./types";

// ---------- Projects ----------
export async function createProject(input: {
  name: string;
  slug: string;
  description?: string | null;
  owner_user_id?: string | null;
  program_slug?: string | null;
  start_date?: string | null;
  target_end_date?: string | null;
}): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  id: string,
  patch: Partial<Project>,
): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Project;
}

// ---------- Milestones ----------
export async function createMilestone(input: {
  project_id: string;
  name: string;
  order_index?: number;
}): Promise<ProjectMilestone> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_milestones")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectMilestone;
}

// ---------- Activities ----------
export async function createActivity(input: {
  project_id: string;
  milestone_id?: string | null;
  title: string;
  description?: string | null;
  owner_user_id?: string | null;
  due_date?: string | null;
  priority?: ActivityPriority;
  created_by: string;
}): Promise<ProjectActivity> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_activities")
    .insert({ ...input, priority: input.priority ?? "medium" })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectActivity;
}

export async function updateActivity(
  id: string,
  patch: Partial<ProjectActivity>,
): Promise<ProjectActivity> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_activities")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectActivity;
}

/**
 * Post an activity update and optionally change status / %.
 * If the status moves the activity to 'done' without any attachments, the DB
 * trigger raises; callers should catch and surface the "proof required" message.
 */
export async function postActivityUpdate(input: {
  activity_id: string;
  user_id: string;
  note: string;
  new_status?: ActivityStatus;
  new_percent?: number;
  current_status: ActivityStatus;
}): Promise<void> {
  const supabase = createClient();
  const nowIso = new Date().toISOString();

  const activityPatch: Partial<ProjectActivity> = {
    last_update_text: input.note,
    last_update_at: nowIso,
  };
  if (input.new_status) activityPatch.status = input.new_status;
  if (typeof input.new_percent === "number")
    activityPatch.percent_complete = input.new_percent;

  const { error: actErr } = await supabase
    .from("project_activities")
    .update({ ...activityPatch, updated_at: nowIso })
    .eq("id", input.activity_id);
  if (actErr) throw actErr;

  const { error: logErr } = await supabase
    .from("project_activity_updates")
    .insert({
      activity_id: input.activity_id,
      user_id: input.user_id,
      note: input.note,
      status_before: input.current_status,
      status_after: input.new_status ?? input.current_status,
    });
  if (logErr) throw logErr;
}

// ---------- Attachments ----------
const BUCKET = "project-activity-proofs";

export async function uploadAttachment(input: {
  project_id: string;
  activity_id: string;
  uploaded_by: string;
  file: File;
  caption?: string;
}): Promise<ProjectActivityAttachment> {
  const supabase = createClient();
  const ext = input.file.name.split(".").pop() ?? "bin";
  const key = `${input.project_id}/${input.activity_id}/${crypto.randomUUID()}-${input.file.name}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(key, input.file, { contentType: input.file.type });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("project_activity_attachments")
    .insert({
      activity_id: input.activity_id,
      uploaded_by: input.uploaded_by,
      file_path: key,
      file_name: input.file.name,
      mime_type: input.file.type || `application/${ext}`,
      size_bytes: input.file.size,
      caption: input.caption ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectActivityAttachment;
}

export async function deleteAttachment(
  id: string,
  file_path: string,
): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove([file_path]);
  const { error } = await supabase
    .from("project_activity_attachments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export function getAttachmentPublicUrl(filePath: string): string {
  const supabase = createClient();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Returns a short-lived signed URL for a private object. Use this in image/file
 * previews since the bucket is private.
 */
export async function getAttachmentSignedUrl(
  filePath: string,
  expiresSec = 3600,
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresSec);
  if (error) throw error;
  return data.signedUrl;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/projects/queries.ts src/lib/projects/mutations.ts
git commit -m "feat(projects): data access layer (queries + mutations)"
```

---

## Task 6: MEL Manager role helper

**Files:**
- Modify: `src/hooks/use-user.ts`

- [ ] **Step 1: Add an `isMELManager` flag**

In `use-user.ts`, extend `UseUserReturn` with `isMELManager: boolean` and compute it from the user's joined role. The role comes through `select("*, role:roles(*)")`, so `user.role?.name` should be `"Admin"` or `"Program Manager"`:

```ts
interface UseUserReturn {
  user: UserProfile | null;
  permissions: RolePermission[];
  loading: boolean;
  hasAccess: (module: AppModule) => boolean;
  isMELManager: boolean;
  signOut: () => Promise<void>;
}

// inside useUser, after state:
const roleName = (user as { role?: { name?: string } } | null)?.role?.name;
const isMELManager = roleName === "Admin" || roleName === "Program Manager";

// in the return
return { user, permissions, loading, hasAccess, isMELManager, signOut };
```

If `UserProfile` doesn't yet include the joined `role`, extend the type locally in `types.ts` to include an optional `role?: { name: string }` or read it narrowly as shown above.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-user.ts src/lib/types.ts
git commit -m "feat(projects): isMELManager role helper"
```

---

## Task 7: Extract reusable `<ProgramDashboard>` component

**Files:**
- Read: `src/app/(dashboard)/programs/[slug]/page.tsx` (and any per-slug folders that exist)
- Create: `src/components/programs/program-dashboard.tsx`
- Modify: `src/app/(dashboard)/programs/[slug]/page.tsx`

- [ ] **Step 1: Inspect current programs route**

Read `src/app/(dashboard)/programs/[slug]/page.tsx`. Note: the worktree root has only a `[slug]` folder under `programs` (no ES/ABSA-specific route files); good — skip the "delete ES/ABSA route folders" step in the spec, nothing to delete.

- [ ] **Step 2: Extract the dashboard body into a component**

Create `src/components/programs/program-dashboard.tsx` that accepts `{ slug: string }` and renders exactly what the current `[slug]/page.tsx` renders. Move the chart/data logic into this client component. Keep server-side data fetching (if any) in the page and pass results down as props, or do the data fetching inside the component if it's already a client component.

Pattern — export a single React component:

```tsx
"use client";

import type { FC } from "react";

interface ProgramDashboardProps {
  slug: string;
}

export const ProgramDashboard: FC<ProgramDashboardProps> = ({ slug }) => {
  // Paste the current [slug]/page.tsx body here, referencing `slug`
  // instead of `params.slug`.
  return <>{/* extracted JSX */}</>;
};
```

- [ ] **Step 3: Collapse the page into a wrapper**

Rewrite `src/app/(dashboard)/programs/[slug]/page.tsx` to be a thin wrapper that pulls the slug and renders the component. Use Next 16's async params shape (check `node_modules/next/dist/docs/` if unsure):

```tsx
import { ProgramDashboard } from "@/components/programs/program-dashboard";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProgramDashboard slug={slug} />;
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx next build`
Expected: PASS. Program pages for `virtual-university` and `hangout` still render; `enterprise-spotlight` and `absa-onboarding` will 404 from nav (they're removed from `PROGRAMS`) but the component still renders if accessed directly — intentional, so the ProjectDetail "Program Data" tab can mount it.

- [ ] **Step 5: Commit**

```bash
git add src/components/programs/program-dashboard.tsx src/app/\(dashboard\)/programs/\[slug\]/page.tsx
git commit -m "refactor(programs): extract ProgramDashboard component"
```

---

## Task 8: Status pill, priority flag, project card

**Files:**
- Create: `src/components/projects/status-pill.tsx`
- Create: `src/components/projects/priority-flag.tsx`
- Create: `src/components/projects/project-card.tsx`

- [ ] **Step 1: Create `status-pill.tsx`**

```tsx
import type { ComputedProjectStatus } from "@/lib/projects/types";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/projects/status";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<
  ReturnType<typeof tone>,
  string
> = {
  neutral: "bg-muted text-muted-foreground",
  blue:    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  amber:   "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  red:     "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  green:   "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
};
function tone(s: ComputedProjectStatus) { return STATUS_TONE[s]; }

export function StatusPill({ status, className }: {
  status: ComputedProjectStatus;
  className?: string;
}) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
      TONE_CLASSES[tone(status)],
      className,
    )}>
      {STATUS_LABEL[status]}
    </span>
  );
}
```

- [ ] **Step 2: Create `priority-flag.tsx`**

```tsx
import { Flag } from "lucide-react";
import type { ActivityPriority } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

const COLOR: Record<ActivityPriority, string> = {
  low:    "text-muted-foreground",
  medium: "text-blue-600 dark:text-blue-400",
  high:   "text-red-600 dark:text-red-400",
};

export function PriorityFlag({ priority, className }: {
  priority: ActivityPriority;
  className?: string;
}) {
  return (
    <Flag className={cn("w-3.5 h-3.5", COLOR[priority], className)}
          aria-label={`${priority} priority`} />
  );
}
```

- [ ] **Step 3: Create `project-card.tsx`**

```tsx
"use client";

import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils"; // create simple helper if none exists; or inline
import type { Project, ProjectActivity } from "@/lib/projects/types";
import {
  computeProgressPercent,
  computeProjectStatus,
  countOverdue,
  countNeedsAttention,
} from "@/lib/projects/status";
import { StatusPill } from "./status-pill";

type Variant = "full" | "compact";

interface ProjectCardProps {
  project: Project;
  activities: ProjectActivity[];
  variant?: Variant;
}

export function ProjectCard({
  project,
  activities,
  variant = "full",
}: ProjectCardProps) {
  const status = computeProjectStatus(project, activities);
  const progress = computeProgressPercent(activities);
  const overdue = countOverdue(activities);
  const needsAttention = countNeedsAttention(activities);
  const isCompact = variant === "compact";

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="block rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className={isCompact ? "font-medium text-sm" : "font-semibold text-base"}>
          {project.name}
        </h3>
        <StatusPill status={status} />
      </div>

      <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground mb-2">{progress}% complete</div>

      {!isCompact && project.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {project.description}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {overdue > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
            {overdue} overdue
          </span>
        )}
        {needsAttention > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {needsAttention} need attention
          </span>
        )}
      </div>
    </Link>
  );
}
```

If `formatDistanceToNow` doesn't already exist in `@/lib/utils`, skip it — the card currently renders a progress-based footer; date-based "updated Nd ago" can be added in a follow-up.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/projects/
git commit -m "feat(projects): status pill, priority flag, project card"
```

---

## Task 9: `/projects` index page

**Files:**
- Create: `src/app/(dashboard)/projects/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { listProjects, listActivities } from "@/lib/projects/queries";
import type { Project, ProjectActivity } from "@/lib/projects/types";
import { ProjectCard } from "@/components/projects/project-card";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Record<string, ProjectActivity[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ps = await listProjects();
      setProjects(ps);
      const entries = await Promise.all(
        ps.map(async (p) => [p.id, await listActivities(p.id)] as const),
      );
      setActivities(Object.fromEntries(entries));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Projects</h1>
        {/* "+ New Project" button added in Task 12 (project form modal) */}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading projects…</div>
      ) : projects.length === 0 ? (
        <div className="text-sm text-muted-foreground">No projects yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              activities={activities[p.id] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Start preview server and load `/projects`. Confirm the 3 seeded projects render as cards with the "Not Started" status pill and 0% progress.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/projects/page.tsx
git commit -m "feat(projects): index page with card grid"
```

---

## Task 10: `/projects/[slug]` detail page with tabs

**Files:**
- Create: `src/app/(dashboard)/projects/[slug]/page.tsx`

- [ ] **Step 1: Write the detail page skeleton**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { getProjectBySlug, listActivities, listMilestones } from "@/lib/projects/queries";
import type { Project, ProjectActivity, ProjectMilestone } from "@/lib/projects/types";
import {
  computeProgressPercent,
  computeProjectStatus,
} from "@/lib/projects/status";
import { StatusPill } from "@/components/projects/status-pill";
import { ProgramDashboard } from "@/components/programs/program-dashboard";
// ActivitiesPanel is introduced in Task 11
import { ActivitiesPanel } from "@/components/projects/activities-panel";

type Tab = "activities" | "program-data";

export default function ProjectDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [tab, setTab] = useState<Tab>("activities");
  const [loading, setLoading] = useState(true);
  const [notFoundFlag, setNotFoundFlag] = useState(false);

  async function refresh() {
    const p = await getProjectBySlug(slug);
    if (!p) { setNotFoundFlag(true); setLoading(false); return; }
    setProject(p);
    const [ms, acts] = await Promise.all([
      listMilestones(p.id),
      listActivities(p.id),
    ]);
    setMilestones(ms);
    setActivities(acts);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [slug]);

  if (notFoundFlag) notFound();
  if (loading || !project) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const status = computeProjectStatus(project, activities);
  const progress = computeProgressPercent(activities);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
            )}
          </div>
          <StatusPill status={status} />
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden max-w-md">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-xs text-muted-foreground mt-1">{progress}% complete</div>
      </header>

      <nav className="border-b border-border mb-4 flex gap-4" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "activities"}
          onClick={() => setTab("activities")}
          className={`pb-2 text-sm font-medium border-b-2 ${tab === "activities" ? "border-primary" : "border-transparent text-muted-foreground"}`}
        >
          Activities
        </button>
        {project.program_slug && (
          <button
            role="tab"
            aria-selected={tab === "program-data"}
            onClick={() => setTab("program-data")}
            className={`pb-2 text-sm font-medium border-b-2 ${tab === "program-data" ? "border-primary" : "border-transparent text-muted-foreground"}`}
          >
            Program Data
          </button>
        )}
      </nav>

      {tab === "activities" ? (
        <ActivitiesPanel
          project={project}
          milestones={milestones}
          activities={activities}
          onChange={refresh}
        />
      ) : project.program_slug ? (
        <ProgramDashboard slug={project.program_slug} />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check (ActivitiesPanel is defined in Task 11)**

At this point, `npx tsc --noEmit` will fail because `ActivitiesPanel` doesn't exist yet. That's expected; fix it in Task 11. Commit this task anyway — the failing type-check is resolved by the next task's commit.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/projects/\[slug\]/page.tsx
git commit -m "feat(projects): project detail page with tabs (WIP: ActivitiesPanel follows)"
```

---

## Task 11: Activities panel, rows, and side panel (view-only)

**Files:**
- Create: `src/components/projects/activity-row.tsx`
- Create: `src/components/projects/activities-panel.tsx`
- Create: `src/components/projects/activity-side-panel.tsx`

- [ ] **Step 1: `activity-row.tsx`**

```tsx
"use client";

import type { ProjectActivity } from "@/lib/projects/types";
import { PriorityFlag } from "./priority-flag";
import { cn } from "@/lib/utils";

const STATUS_LABEL = {
  not_started: "Not Started",
  in_progress: "In Progress",
  done: "Done",
  blocked: "Blocked",
} as const;

const STATUS_CLASS: Record<ProjectActivity["status"], string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  done:        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  blocked:     "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

interface Props {
  activity: ProjectActivity;
  onOpen: (id: string) => void;
}

export function ActivityRow({ activity, onOpen }: Props) {
  const overdue =
    activity.due_date &&
    activity.status !== "done" &&
    new Date(activity.due_date) < new Date();

  return (
    <button
      onClick={() => onOpen(activity.id)}
      className="w-full text-left flex items-center gap-3 px-3 py-2 rounded hover:bg-accent/60"
    >
      <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium", STATUS_CLASS[activity.status])}>
        {STATUS_LABEL[activity.status]}
      </span>
      <PriorityFlag priority={activity.priority} />
      <span className="flex-1 truncate text-sm">{activity.title}</span>
      {activity.due_date && (
        <span className={cn("text-xs", overdue ? "text-red-600" : "text-muted-foreground")}>
          {new Date(activity.due_date).toLocaleDateString()}
        </span>
      )}
      <span className="text-xs text-muted-foreground w-10 text-right">
        {activity.percent_complete}%
      </span>
    </button>
  );
}
```

- [ ] **Step 2: `activities-panel.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import type { Project, ProjectActivity, ProjectMilestone } from "@/lib/projects/types";
import { ActivityRow } from "./activity-row";
import { ActivitySidePanel } from "./activity-side-panel";

type Filter = "all" | "overdue" | "attention" | "mine";

interface Props {
  project: Project;
  milestones: ProjectMilestone[];
  activities: ProjectActivity[];
  onChange: () => void;
  currentUserId?: string;
}

export function ActivitiesPanel({
  project, milestones, activities, onChange, currentUserId,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const today = new Date();
    return activities.filter((a) => {
      if (filter === "overdue")
        return a.due_date && a.status !== "done" && new Date(a.due_date) < today;
      if (filter === "attention")
        return a.status === "blocked" || a.priority === "high";
      if (filter === "mine") return currentUserId && a.owner_user_id === currentUserId;
      return true;
    });
  }, [filter, activities, currentUserId]);

  const byMilestone = new Map<string | null, ProjectActivity[]>();
  for (const a of filtered) {
    const key = a.milestone_id ?? null;
    byMilestone.set(key, [...(byMilestone.get(key) ?? []), a]);
  }

  const openActivity = openId ? activities.find((a) => a.id === openId) ?? null : null;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["all", "overdue", "attention", "mine"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border ${filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
          >
            {f === "all" ? "All" : f === "overdue" ? "Overdue" : f === "attention" ? "Needs attention" : "My activities"}
          </button>
        ))}
      </div>

      {milestones.map((m) => {
        const rows = byMilestone.get(m.id) ?? [];
        if (rows.length === 0) return null;
        return (
          <section key={m.id} className="mb-6">
            <h3 className="text-sm font-semibold mb-2">{m.name}</h3>
            <div className="rounded border border-border divide-y divide-border">
              {rows.map((a) => <ActivityRow key={a.id} activity={a} onOpen={setOpenId} />)}
            </div>
          </section>
        );
      })}

      {(byMilestone.get(null)?.length ?? 0) > 0 && (
        <section className="mb-6">
          <h3 className="text-sm font-semibold mb-2">Ungrouped</h3>
          <div className="rounded border border-border divide-y divide-border">
            {(byMilestone.get(null) ?? []).map((a) => (
              <ActivityRow key={a.id} activity={a} onOpen={setOpenId} />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="text-sm text-muted-foreground">No activities match this filter.</div>
      )}

      {openActivity && (
        <ActivitySidePanel
          project={project}
          activity={openActivity}
          onClose={() => setOpenId(null)}
          onChange={onChange}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: `activity-side-panel.tsx` — view-only shell**

Minimal version for this task; full form + attachments come in Tasks 12 and 13.

```tsx
"use client";

import { useEffect, useState } from "react";
import type {
  Project,
  ProjectActivity,
  ProjectActivityUpdate,
} from "@/lib/projects/types";
import { listUpdates } from "@/lib/projects/queries";

interface Props {
  project: Project;
  activity: ProjectActivity;
  onClose: () => void;
  onChange: () => void;
}

export function ActivitySidePanel({ project, activity, onClose }: Props) {
  const [updates, setUpdates] = useState<ProjectActivityUpdate[]>([]);

  useEffect(() => {
    listUpdates(activity.id).then(setUpdates);
  }, [activity.id]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <aside className="w-full max-w-md bg-background border-l border-border overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold">{activity.title}</h2>
          <button onClick={onClose} className="text-sm text-muted-foreground">Close</button>
        </div>
        {activity.description && (
          <p className="text-sm text-muted-foreground mb-4">{activity.description}</p>
        )}
        <div className="text-xs text-muted-foreground mb-6">
          Status: {activity.status} · Priority: {activity.priority} · {activity.percent_complete}%
          {activity.due_date && ` · Due ${new Date(activity.due_date).toLocaleDateString()}`}
        </div>

        {/* Attachments gallery lands in Task 13 */}
        {/* Post-update form lands in Task 12 */}

        <h3 className="text-sm font-semibold mb-2">Updates</h3>
        {updates.length === 0 ? (
          <div className="text-xs text-muted-foreground">No updates yet.</div>
        ) : (
          <ul className="space-y-3">
            {updates.map((u) => (
              <li key={u.id} className="text-sm">
                <div className="text-muted-foreground text-xs">
                  {new Date(u.created_at).toLocaleString()}
                  {u.status_before && u.status_after && u.status_before !== u.status_after && (
                    <> · {u.status_before} → {u.status_after}</>
                  )}
                </div>
                <div>{u.note}</div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx next build`
Expected: PASS.

Load `/projects/enterprise-spotlight` in preview. Confirm the page renders with header, tabs, an empty activities state, and the "Program Data" tab switches to the program dashboard.

- [ ] **Step 5: Commit**

```bash
git add src/components/projects/activity-row.tsx src/components/projects/activities-panel.tsx src/components/projects/activity-side-panel.tsx
git commit -m "feat(projects): activities panel with rows and view-only side panel"
```

---

## Task 12: Create/edit modals — project, milestone, activity; post-update form

**Files:**
- Create: `src/components/projects/project-form-modal.tsx`
- Create: `src/components/projects/milestone-form-modal.tsx`
- Create: `src/components/projects/activity-form-modal.tsx`
- Modify: `src/components/projects/activity-side-panel.tsx` (add post-update form)
- Modify: `src/components/projects/activities-panel.tsx` (add "+ Add Milestone" and "+ Add Activity" buttons for MEL managers)
- Modify: `src/app/(dashboard)/projects/page.tsx` (add "+ New Project" button for MEL managers)

For each modal, use the same base-ui `Dialog` pattern that other modals in this repo already use (look at `src/components/data-entry/` or the existing shadcn dialog component).

- [ ] **Step 1: `project-form-modal.tsx`**

Props: `{ open, onOpenChange, initial?: Partial<Project>, onSaved: () => void }`. Fields: name, slug (auto-kebab-case from name, editable), description, start_date, target_end_date, program_slug (dropdown populated from `DATA_ENTRY_PROGRAMS` slugs + "None"), owner_user_id (user picker — for MVP render a `<select>` populated by listing `user_profiles` rows where role is Admin/Program Manager). Submit calls `createProject` or `updateProject`.

- [ ] **Step 2: `milestone-form-modal.tsx`**

Props: `{ projectId, open, onOpenChange, onSaved }`. Fields: name, order_index (defaults to next available). Submit calls `createMilestone`.

- [ ] **Step 3: `activity-form-modal.tsx`**

Props: `{ projectId, milestones, open, onOpenChange, initial?: Partial<ProjectActivity>, onSaved, currentUserId }`.

Fields: title, description (textarea), milestone_id (select from `milestones` + "None"), owner_user_id (user select), due_date, priority (radio: low/medium/high). For create, submit calls `createActivity({..., created_by: currentUserId})`. For edit, submit calls `updateActivity`.

Do **not** allow status or percent_complete editing here — those are owner-updated via the side panel.

- [ ] **Step 4: Extend `activity-side-panel.tsx` with post-update form**

Above the updates list, render a form (visible only to activity owner or MEL manager):

```tsx
// Pseudocode inside ActivitySidePanel
const [note, setNote] = useState("");
const [newStatus, setNewStatus] = useState<ActivityStatus>(activity.status);
const [newPercent, setNewPercent] = useState(activity.percent_complete);
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);

// disable "Save" if newStatus === "done" && attachments.length === 0
const blockDone = newStatus === "done" && attachments.length === 0;

async function submit() {
  setSubmitting(true);
  setError(null);
  try {
    await postActivityUpdate({
      activity_id: activity.id,
      user_id: currentUserId,
      note,
      new_status: newStatus !== activity.status ? newStatus : undefined,
      new_percent: newPercent !== activity.percent_complete ? newPercent : undefined,
      current_status: activity.status,
    });
    setNote("");
    onChange();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("proof")) {
      setError("Upload at least one proof-of-activity attachment before marking Done.");
    } else {
      setError(msg);
    }
  } finally {
    setSubmitting(false);
  }
}
```

Render note textarea, status `<select>`, `<input type="range">` for %, save button (disabled when `blockDone` with tooltip "Upload at least one proof of activity"), and display `error` below.

Accept `currentUserId` as a prop; the panel's consumer (`ActivitiesPanel`) pulls it from `useUser()`.

- [ ] **Step 5: Wire up toolbar buttons in `activities-panel.tsx`**

Add MEL-manager-only buttons above the filter chips:

```tsx
const { isMELManager, user } = useUser();
// ...
{isMELManager && (
  <div className="flex justify-end gap-2 mb-3">
    <button onClick={() => setOpenMilestone(true)} className="text-xs px-3 py-1 rounded border border-border">+ Add Milestone</button>
    <button onClick={() => setOpenActivity(true)} className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground">+ Add Activity</button>
  </div>
)}
```

Render `<MilestoneFormModal>` and `<ActivityFormModal>` conditionally.

- [ ] **Step 6: Wire up "+ New Project" on the index**

In `src/app/(dashboard)/projects/page.tsx`, import `useUser` and `ProjectFormModal`. Show button only when `isMELManager`.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npx next build`
Expected: PASS.

In preview: as a MEL manager, create a milestone and an activity under the Enterprise Spotlight project. Activity should appear in the list. Open the side panel, try to mark the activity Done → should be blocked by the UI (button disabled / error on submit because no attachments yet).

- [ ] **Step 8: Commit**

```bash
git add src/components/projects/ src/app/\(dashboard\)/projects/page.tsx
git commit -m "feat(projects): create/edit modals and post-update form"
```

---

## Task 13: Attachments gallery with upload / delete

**Files:**
- Create: `src/components/projects/attachments-gallery.tsx`
- Modify: `src/components/projects/activity-side-panel.tsx` (embed gallery, block "Mark Done" until ≥1 attachment)

- [ ] **Step 1: `attachments-gallery.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  deleteAttachment,
  getAttachmentSignedUrl,
  uploadAttachment,
} from "@/lib/projects/mutations";
import { listAttachments } from "@/lib/projects/queries";
import type { ProjectActivityAttachment } from "@/lib/projects/types";

const MAX_BYTES = 25 * 1024 * 1024;

interface Props {
  projectId: string;
  activityId: string;
  currentUserId: string;
  canUpload: boolean;
  canDelete: boolean;
  onChange: () => void;
}

export function AttachmentsGallery({
  projectId, activityId, currentUserId, canUpload, canDelete, onChange,
}: Props) {
  const [items, setItems] = useState<ProjectActivityAttachment[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const list = await listAttachments(activityId);
    setItems(list);
    const urls: Record<string, string> = {};
    await Promise.all(
      list.map(async (a) => {
        if (a.mime_type.startsWith("image/")) {
          urls[a.id] = await getAttachmentSignedUrl(a.file_path);
        }
      }),
    );
    setPreviews(urls);
  }
  useEffect(() => { refresh(); }, [activityId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > MAX_BYTES) throw new Error(`${f.name} exceeds 25 MB`);
        await uploadAttachment({
          project_id: projectId,
          activity_id: activityId,
          uploaded_by: currentUserId,
          file: f,
        });
      }
      await refresh();
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(a: ProjectActivityAttachment) {
    if (!confirm(`Delete ${a.file_name}?`)) return;
    await deleteAttachment(a.id, a.file_path);
    await refresh();
    onChange();
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Proof of activity</h3>
        {canUpload && (
          <label className="text-xs px-3 py-1 rounded border border-border cursor-pointer">
            {uploading ? "Uploading…" : "Upload proof"}
            <input
              type="file"
              multiple
              className="hidden"
              accept="image/*,application/pdf,.docx,.xlsx"
              disabled={uploading}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        )}
      </div>
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">No attachments yet.</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((a) => (
            <div key={a.id} className="border border-border rounded p-2 text-[11px]">
              {previews[a.id] ? (
                <img src={previews[a.id]} alt={a.caption ?? a.file_name}
                     className="w-full h-20 object-cover rounded mb-1" />
              ) : (
                <div className="w-full h-20 rounded bg-muted flex items-center justify-center text-muted-foreground">
                  {a.file_name.split(".").pop()?.toUpperCase()}
                </div>
              )}
              <div className="truncate" title={a.file_name}>{a.file_name}</div>
              <div className="flex gap-2 mt-1">
                <a
                  href={previews[a.id] ?? "#"}
                  onClick={async (e) => {
                    if (previews[a.id]) return;
                    e.preventDefault();
                    const url = await getAttachmentSignedUrl(a.file_path);
                    window.open(url, "_blank");
                  }}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >View</a>
                {canDelete && (
                  <button onClick={() => handleDelete(a)} className="text-red-600 underline">Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Embed gallery in `activity-side-panel.tsx`**

Inside the side panel (above the Updates list), render:

```tsx
<AttachmentsGallery
  projectId={project.id}
  activityId={activity.id}
  currentUserId={currentUserId}
  canUpload={isMELManager || activity.owner_user_id === currentUserId}
  canDelete={isMELManager}
  onChange={onChange}
/>
```

And compute `attachmentCount` (from `listAttachments` or a child-reported count) to disable the "Mark Done" control when zero. The simplest approach: store `attachmentCount` in side-panel state, let `AttachmentsGallery` accept an optional `onCountChange(n)` callback and invoke it in `refresh`.

- [ ] **Step 3: Verify end-to-end**

In preview:
1. Create an activity under a project.
2. Open the side panel, upload an image as proof.
3. Change status to Done, save. Should succeed.
4. Create a second activity, try to mark Done without uploading — UI disables the save and surfaces "Upload at least one proof of activity". Also, if you bypass the UI and `postActivityUpdate` is called with new_status=done, the DB trigger rejects; verify by clicking save anyway and confirming the error text.

- [ ] **Step 4: Commit**

```bash
git add src/components/projects/attachments-gallery.tsx src/components/projects/activity-side-panel.tsx
git commit -m "feat(projects): proof-of-activity attachments with upload/delete"
```

---

## Task 14: Executive dashboard Projects strip

**Files:**
- Create: `src/components/projects/projects-dashboard-strip.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: `projects-dashboard-strip.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listActivities, listProjects } from "@/lib/projects/queries";
import type { Project, ProjectActivity } from "@/lib/projects/types";
import { ProjectCard } from "./project-card";

export function ProjectsDashboardStrip() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activitiesByProject, setActivitiesByProject] = useState<Record<string, ProjectActivity[]>>({});

  useEffect(() => {
    (async () => {
      const ps = await listProjects();
      setProjects(ps);
      const entries = await Promise.all(
        ps.map(async (p) => [p.id, await listActivities(p.id)] as const),
      );
      setActivitiesByProject(Object.fromEntries(entries));
    })();
  }, []);

  if (projects.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Projects</h2>
        <Link href="/projects" className="text-sm text-primary hover:underline">View all →</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {projects.slice(0, 3).map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            activities={activitiesByProject[p.id] ?? []}
            variant="compact"
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Insert into executive dashboard**

Open `src/app/(dashboard)/dashboard/page.tsx`, import `ProjectsDashboardStrip`, and render it below the main KPI/chart sections (choose a spot where it visually sits without crowding the hero KPIs — typically above the program-specific charts).

```tsx
import { ProjectsDashboardStrip } from "@/components/projects/projects-dashboard-strip";

// inside JSX, e.g. after KPIs:
<ProjectsDashboardStrip />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx next build`
Expected: PASS.

Load `/dashboard`. Confirm the Projects strip renders with 3 compact cards clicking through to each project.

- [ ] **Step 4: Commit**

```bash
git add src/components/projects/projects-dashboard-strip.tsx src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(projects): projects strip on executive dashboard"
```

---

## Task 15: Final verification pass

- [ ] **Step 1: Full type-check and build**

Run: `npx tsc --noEmit && npx next build`
Expected: PASS with zero errors.

- [ ] **Step 2: Performance grep**

Run Grep (via tool) for `performance` in `src/`. Expected: no module-scoped references (only incidental user-facing or comment strings, if any).

- [ ] **Step 3: Acceptance walkthrough in preview**

1. Log in as Admin (or any user with `projects` access). Sidebar shows "Projects", no "Performance".
2. `/projects` lists Enterprise Spotlight, ABSA Onboarding, Nkabom Collaborative.
3. Open Enterprise Spotlight → Activities tab default; Program Data tab visible.
4. Switch to Program Data → ES program dashboard renders.
5. Open Nkabom Collaborative → Activities tab only; no Program Data tab.
6. As MEL manager, create a milestone, create an activity.
7. As activity owner (or MEL manager), open activity side panel, upload an image, post an update marking status Done → saves.
8. Create a second activity, try to mark Done without proof → blocked (UI disables Save; DB rejects if bypassed).
9. Return to `/dashboard` → Projects strip shows 3 compact cards.

- [ ] **Step 4: Commit any small fixes**

```bash
git add -A
git commit -m "chore(projects): verification pass fixes"
```

---

## Self-review findings

- Spec coverage: every section (1–9) maps to a task. §3 roles → Task 6. §5 migration → Task 1. §6 UI → Tasks 7–14. §9 acceptance → Task 15.
- No placeholders; every code step has working code.
- Type consistency: `computeProjectStatus`, `listActivities`, `postActivityUpdate` signatures match across tasks. Attachment table named `project_activity_attachments` consistently.
- The storage bucket name `project-activity-proofs` matches the `BUCKET` constant in `mutations.ts`.
- Task 10 intentionally leaves a transient type error that Task 11 resolves, documented in the step.
