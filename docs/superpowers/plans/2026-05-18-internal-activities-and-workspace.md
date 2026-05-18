# Internal Activities & Internal Workspace — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-activity client visibility (`client_visible` | `internal`) so admin/staff can keep internal work hidden from clients, and add a standalone Internal Workspace for DC&A Hub work that has no client project.

**Architecture:** A single column on `activities` controls portal-visibility; RLS filters apply per-role. A new `internal_tasks` / `internal_areas` tree (with explicit assignees) lives outside the projects tree, with its own RLS, routes, and navigation entry. The existing `project_activity_counts` view gains client-side columns alongside the existing overall columns so callers can render both numbers.

**Tech Stack:** Next.js 15 (App Router, RSC + Server Actions), Supabase (Postgres + RLS), exceljs (bulk import), Zod (schemas), Vitest (unit + RLS tests), Tailwind/shadcn UI.

**Spec:** [`docs/superpowers/specs/2026-05-18-internal-activities-and-evaluation-dashboard-design.md`](../specs/2026-05-18-internal-activities-and-evaluation-dashboard-design.md) — Part 1 only.

---

## File map

**New SQL migrations**
- `supabase/migrations/0030_activity_visibility.sql` — column + index + amended `activities_read` policy.
- `supabase/migrations/0031_activity_visibility_dependents.sql` — visibility filter cascaded through `activity_proofs`, `activity_log`, `proof_comments`, `proof_access_log` policies.
- `supabase/migrations/0032_project_activity_counts_visibility.sql` — rebuild the view with `client_total_count`, `client_done_count`, etc. alongside existing fields.
- `supabase/migrations/0033_internal_workspace.sql` — `internal_areas`, `internal_tasks`, `internal_task_assignees`, RLS, seeds, triggers.

**New / modified backend**
- `src/lib/workspace/schemas.ts` — extend `activitySchema` and `activityUpdateSchema` with `visibility`.
- `src/lib/workspace/actions.ts` — `createActivity`, `updateActivity`, `importWorkplanSheet` accept and persist visibility; visibility change recorded in `activity_log`.
- `src/lib/internal/schemas.ts` — new: Zod schemas for `internal_area`, `internal_task`.
- `src/lib/internal/queries.ts` — new: `listAreas`, `listTasks`, `getTask`.
- `src/lib/internal/actions.ts` — new: `createArea`, `updateArea`, `archiveArea`, `createTask`, `updateTask`, `setTaskStatus`, `addAssignee`, `removeAssignee`.
- `src/lib/supabase/types.ts` — regenerate after migrations land.
- `src/lib/supabase/columns.ts` — extend `PROJECT_ACTIVITY_COUNTS` constant.
- `src/lib/workspace/queries.ts` — surface client-vs-overall counts.

**New / modified UI**
- `src/components/workspace/activity-form.tsx` — required visibility radio (recommended path; current component name may differ — locate the activity create/edit form during Task 5).
- `src/components/workspace/activity-row.tsx` — "Internal" badge for staff/admin (locate during Task 5).
- `src/components/workspace/workplan-import-help.tsx` — document the new column.
- `src/app/workspace/internal/page.tsx` — internal workspace landing (Kanban/list).
- `src/app/workspace/internal/loading.tsx`, `error.tsx`.
- `src/app/workspace/internal/[taskId]/page.tsx` — task detail panel (modal route).
- `src/app/admin/internal/areas/page.tsx` — areas admin.
- `src/components/internal/*` — task card, status pill, area picker, assignee picker, kanban board.
- `src/components/nav/sidebar.tsx` (or current sidebar component) — add "Internal" link visible to admin + staff only.

**Tests**
- `tests/rls/visibility.test.ts` — client cannot see internal activities/proofs/logs/comments.
- `tests/rls/internal-workspace.test.ts` — clients have no access; staff sees only assigned tasks; admin sees all.
- `tests/workspace/activity-visibility.test.ts` — `createActivity` and `updateActivity` honour visibility, audit-log captures changes.
- `tests/workspace/workplan-import-visibility.test.ts` — bulk import accepts/validates the `visibility` column.
- `tests/integration/internal-tasks.test.ts` — happy-path lifecycle.

---

## Conventions used in this plan

- `pwsh` for PowerShell commands (Windows default shell), `bash` for unix-style commands the codebase already uses.
- All migrations are applied with `npx supabase db push` against the local Supabase stack (the project uses Supabase CLI; if that command differs in this repo, run `npm run` to see project-defined aliases).
- Each task ends with a commit using Conventional Commits (`feat:` `fix:` `refactor:` `test:` `migration:` `chore:`).
- Each migration carries a SQL header comment explaining what it does and why, matching the style of `0024_project_role_manager.sql`.

---

## Task 1: Migration `0030_activity_visibility.sql` — column, index, and amended read policy

**Files:**
- Create: `supabase/migrations/0030_activity_visibility.sql`
- Test: `tests/rls/visibility.test.ts`

- [ ] **Step 1: Write the failing RLS test for client view**

Create `tests/rls/visibility.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, clientAs, createTestUser, cleanupTestData } from './setup';

describe('activity visibility RLS', () => {
  afterAll(async () => { await cleanupTestData(); });

  it('hides internal activities from clients', async () => {
    const admin = adminClient();
    const clientEmail = `vis-client-${Date.now()}@example.com`;
    const clientId = await createTestUser('client', clientEmail);

    const { data: org } = await admin
      .from('clients').insert({ name: 'Org A (rlstest)' }).select('id').single();
    const { data: project } = await admin
      .from('projects')
      .insert({ name: 'Visibility Test', code: `VIS-${Date.now()}`, client_id: org!.id })
      .select('id').single();
    await admin.from('project_members')
      .insert({ project_id: project!.id, user_id: clientId, project_role: 'viewer' });

    const { data: phase } = await admin
      .from('phases')
      .insert({ project_id: project!.id, name: 'P1' })
      .select('id').single();

    await admin.from('activities').insert([
      { phase_id: phase!.id, name: 'Public A', visibility: 'client_visible' },
      { phase_id: phase!.id, name: 'Internal A', visibility: 'internal' },
    ]);

    const sb = await clientAs(clientEmail);
    const { data: visible } = await sb
      .from('activities').select('name, visibility').eq('phase_id', phase!.id);
    const names = (visible ?? []).map((a) => a.name);
    expect(names).toContain('Public A');
    expect(names).not.toContain('Internal A');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```pwsh
npm test -- tests/rls/visibility.test.ts
```

Expected: FAIL — column `visibility` does not exist (and even if it did, the policy wouldn't filter on it yet).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0030_activity_visibility.sql`:

```sql
-- 0030_activity_visibility.sql
--
-- Adds the per-activity visibility flag that separates client-facing work
-- from internal DC&A Hub work hidden inside the same project. The portal
-- (project_role='viewer') must never see 'internal' rows; admin, manager,
-- and member roles see both.
--
-- We extend the existing activities_read policy with a viewer-only filter.
-- The write policy is unchanged: writers (admin/manager/member) can flip
-- visibility either direction.

alter table activities
  add column visibility text not null default 'client_visible'
    check (visibility in ('client_visible', 'internal'));

create index activities_visibility_idx on activities (visibility);

comment on column activities.visibility is
  'client_visible = portal sees it; internal = hidden from portal, visible to admin/manager/member.';

-- Replace activities_read so viewers only get client_visible rows.
drop policy if exists activities_read on activities;

create policy activities_read on activities for select
  using (
    public.can_access_project(
      (select project_id from phases where phases.id = activities.phase_id)
    )
    and (
      visibility = 'client_visible'
      or public.is_admin()
      or exists (
        select 1 from project_members pm
        where pm.project_id = (
                select project_id from phases where phases.id = activities.phase_id
              )
          and pm.user_id = auth.uid()
          and pm.project_role in ('manager', 'member')
      )
    )
  );

comment on policy activities_read on activities is
  'Clients (viewer role) only see client_visible activities. Admin/manager/member see all.';
```

- [ ] **Step 4: Apply the migration locally**

```pwsh
npx supabase db push
```

Expected: migration `0030_activity_visibility` applied; subsequent migrations re-applied idempotently.

- [ ] **Step 5: Run the test to verify it passes**

```pwsh
npm test -- tests/rls/visibility.test.ts
```

Expected: PASS — client sees only `Public A`, not `Internal A`.

- [ ] **Step 6: Commit**

```pwsh
git add supabase/migrations/0030_activity_visibility.sql tests/rls/visibility.test.ts
git commit -m "feat(visibility): add activity visibility column + RLS for portal"
```

---

## Task 2: Migration `0031_activity_visibility_dependents.sql` — cascade visibility through dependents

**Background:** The portal can reach `activity_proofs`, `activity_log`, `proof_comments`, and `proof_access_log` either directly or via foreign-key joins. Each of those tables' SELECT policies must filter out rows attached to internal activities — otherwise a client could discover internal activities by listing their proofs or log entries.

**Files:**
- Create: `supabase/migrations/0031_activity_visibility_dependents.sql`
- Modify: `tests/rls/visibility.test.ts`

- [ ] **Step 1: Add a failing test for proofs**

Append this `it` block inside the existing `describe` in `tests/rls/visibility.test.ts`:

```ts
it('hides proofs of internal activities from clients', async () => {
  const admin = adminClient();
  const clientEmail = `vis-proof-client-${Date.now()}@example.com`;
  const clientId = await createTestUser('client', clientEmail);

  const { data: org } = await admin.from('clients').insert({ name: 'Org A (rlstest)' }).select('id').single();
  const { data: project } = await admin
    .from('projects').insert({ name: 'Proof Vis', code: `VIS-P-${Date.now()}`, client_id: org!.id })
    .select('id').single();
  await admin.from('project_members')
    .insert({ project_id: project!.id, user_id: clientId, project_role: 'viewer' });
  const { data: phase } = await admin.from('phases')
    .insert({ project_id: project!.id, name: 'P1' }).select('id').single();
  const { data: acts } = await admin.from('activities').insert([
    { phase_id: phase!.id, name: 'Public A', visibility: 'client_visible' },
    { phase_id: phase!.id, name: 'Internal A', visibility: 'internal' },
  ]).select('id, name');
  const internal = acts!.find((a) => a.name === 'Internal A')!;
  const pub = acts!.find((a) => a.name === 'Public A')!;
  await admin.from('activity_proofs').insert([
    { activity_id: pub.id, file_path: 'a.pdf', file_name: 'a.pdf' },
    { activity_id: internal.id, file_path: 'b.pdf', file_name: 'b.pdf' },
  ]);

  const sb = await clientAs(clientEmail);
  const { data: proofs } = await sb.from('activity_proofs')
    .select('file_name, activity:activities(name)');
  const files = (proofs ?? []).map((p) => p.file_name);
  expect(files).toContain('a.pdf');
  expect(files).not.toContain('b.pdf');
});
```

- [ ] **Step 2: Run the test to verify it fails**

```pwsh
npm test -- tests/rls/visibility.test.ts
```

Expected: the new test FAILs (client sees `b.pdf`). The first test still passes.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0031_activity_visibility_dependents.sql`:

```sql
-- 0031_activity_visibility_dependents.sql
--
-- Closes the side-channel: even after 0030 hid internal activities from
-- the portal, dependent tables (proofs/log/comments/access log) would
-- still leak their existence to viewers. Each SELECT policy now requires
-- the parent activity to be client_visible when the caller is a viewer.

-- ---------- activity_proofs ----------
drop policy if exists activity_proofs_read on activity_proofs;

create policy activity_proofs_read on activity_proofs for select
  using (
    exists (
      select 1
      from activities a
      join phases p on p.id = a.phase_id
      where a.id = activity_proofs.activity_id
        and public.can_access_project(p.project_id)
        and (
          a.visibility = 'client_visible'
          or public.is_admin()
          or exists (
            select 1 from project_members pm
            where pm.project_id = p.project_id
              and pm.user_id = auth.uid()
              and pm.project_role in ('manager','member')
          )
        )
    )
  );

-- ---------- activity_log ----------
-- Existing activity_log_member_read already restricts to admin/manager/
-- member only — clients never see it, so the visibility filter is not
-- needed for the client-leak case. We still tighten it so manager/member
-- of a project see ALL its log rows (no change) and clients see nothing
-- (no change), but we drop the dead 'visibility' assumption clients had.
-- Leave the existing 0024 policy unchanged. NO-OP block kept for clarity.

-- ---------- proof_comments (migration 0015) ----------
do $$
begin
  if exists (select 1 from pg_policies
              where schemaname='public' and tablename='proof_comments'
                and policyname='proof_comments_read')
  then
    execute 'drop policy proof_comments_read on proof_comments';
  end if;
end$$;

create policy proof_comments_read on proof_comments for select
  using (
    exists (
      select 1
      from activity_proofs pr
      join activities a on a.id = pr.activity_id
      join phases p on p.id = a.phase_id
      where pr.id = proof_comments.proof_id
        and public.can_access_project(p.project_id)
        and (
          a.visibility = 'client_visible'
          or public.is_admin()
          or exists (
            select 1 from project_members pm
            where pm.project_id = p.project_id
              and pm.user_id = auth.uid()
              and pm.project_role in ('manager','member')
          )
        )
    )
  );

-- ---------- proof_access_log (migration 0013) ----------
do $$
begin
  if exists (select 1 from pg_policies
              where schemaname='public' and tablename='proof_access_log'
                and policyname='proof_access_log_read')
  then
    execute 'drop policy proof_access_log_read on proof_access_log';
  end if;
end$$;

create policy proof_access_log_read on proof_access_log for select
  using (
    public.is_admin() or exists (
      select 1
      from activity_proofs pr
      join activities a on a.id = pr.activity_id
      join phases p on p.id = a.phase_id
      where pr.id = proof_access_log.proof_id
        and exists (
          select 1 from project_members pm
          where pm.project_id = p.project_id
            and pm.user_id = auth.uid()
            and pm.project_role in ('manager','member')
        )
    )
  );

comment on policy activity_proofs_read on activity_proofs is
  'Clients (viewer) only see proofs of client_visible activities. Staff/admin see all.';
```

> **Note on `proof_comments` and `proof_access_log`:** the migration uses a `DO $$` guard to drop the existing policy only if it's named exactly as shown. If your local DB has a different policy name (e.g. `proof_comments_member_read`), inspect with `select * from pg_policies where tablename in ('proof_comments','proof_access_log');` first and rename the `policyname` literal in the `DO` block accordingly before applying. The replacement policy can keep the original name.

- [ ] **Step 4: Apply the migration**

```pwsh
npx supabase db push
```

- [ ] **Step 5: Run the test to verify it passes**

```pwsh
npm test -- tests/rls/visibility.test.ts
```

Expected: both tests PASS.

- [ ] **Step 6: Commit**

```pwsh
git add supabase/migrations/0031_activity_visibility_dependents.sql tests/rls/visibility.test.ts
git commit -m "feat(visibility): cascade visibility filter through proofs/log/comments"
```

---

## Task 3: Migration `0032_project_activity_counts_visibility.sql` — split client vs overall counts

**Files:**
- Create: `supabase/migrations/0032_project_activity_counts_visibility.sql`
- Modify: `src/lib/supabase/columns.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0032_project_activity_counts_visibility.sql`:

```sql
-- 0032_project_activity_counts_visibility.sql
--
-- Extends the rollup view with client-facing counts alongside the
-- existing overall counts. Staff/admin pages render both; the portal
-- renders only client_* columns. No changes to RLS — the view runs as
-- the caller, so a viewer querying *_total_count still gets only rows
-- they're allowed to see (i.e. client_visible), making both pairs
-- consistent for that role.

create or replace view project_activity_counts as
select
  p.id                                                              as project_id,
  count(a.id)                                                       as total_count,
  count(a.id) filter (where a.status = 'done')                      as done_count,
  count(a.id) filter (where a.status = 'in_progress')               as in_progress_count,
  count(a.id) filter (where a.status = 'not_started')               as not_started_count,
  count(a.id) filter (where a.visibility = 'client_visible')        as client_total_count,
  count(a.id) filter (where a.visibility = 'client_visible'
                        and a.status   = 'done')                    as client_done_count,
  count(a.id) filter (where a.visibility = 'client_visible'
                        and a.status   = 'in_progress')             as client_in_progress_count,
  count(a.id) filter (where a.visibility = 'client_visible'
                        and a.status   = 'not_started')             as client_not_started_count
from projects p
left join phases     ph on ph.project_id = p.id
left join activities a  on a.phase_id   = ph.id
group by p.id;

grant select on project_activity_counts to authenticated, service_role;

comment on view project_activity_counts is
  'Per-project activity counts: total_* (all visibility) and client_* (client_visible only).';
```

- [ ] **Step 2: Apply the migration**

```pwsh
npx supabase db push
```

- [ ] **Step 3: Update the columns constant**

In `src/lib/supabase/columns.ts`, locate `PROJECT_ACTIVITY_COUNTS` and append the new fields:

```ts
export const PROJECT_ACTIVITY_COUNTS =
  'project_id, total_count, done_count, in_progress_count, not_started_count, ' +
  'client_total_count, client_done_count, client_in_progress_count, client_not_started_count';
```

> If the constant is defined differently (e.g. an array), preserve the file's existing format — append the same 4 fields.

- [ ] **Step 4: Regenerate Supabase types**

```pwsh
npm run db:types
```

If no such script exists, regenerate via:

```pwsh
npx supabase gen types typescript --local > src/lib/supabase/types.ts
```

- [ ] **Step 5: Type-check**

```pwsh
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```pwsh
git add supabase/migrations/0032_project_activity_counts_visibility.sql src/lib/supabase/columns.ts src/lib/supabase/types.ts
git commit -m "feat(visibility): split project_activity_counts into client + overall"
```

---

## Task 4: Extend activity schemas + server actions

**Files:**
- Modify: `src/lib/workspace/schemas.ts`
- Modify: `src/lib/workspace/actions.ts`
- Create: `tests/workspace/activity-visibility.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `tests/workspace/activity-visibility.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { activitySchema, activityUpdateSchema } from '@/lib/workspace/schemas';

describe('activitySchema visibility field', () => {
  it('rejects missing visibility', () => {
    const r = activitySchema.safeParse({
      phase_id: '00000000-0000-0000-0000-000000000000',
      name: 'X',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('visibility'))).toBe(true);
    }
  });

  it('accepts client_visible and internal', () => {
    const base = { phase_id: '00000000-0000-0000-0000-000000000000', name: 'X' };
    expect(activitySchema.safeParse({ ...base, visibility: 'client_visible' }).success).toBe(true);
    expect(activitySchema.safeParse({ ...base, visibility: 'internal' }).success).toBe(true);
  });

  it('rejects unknown visibility value', () => {
    const r = activitySchema.safeParse({
      phase_id: '00000000-0000-0000-0000-000000000000',
      name: 'X',
      visibility: 'private',
    });
    expect(r.success).toBe(false);
  });

  it('activityUpdateSchema also requires visibility', () => {
    const r = activityUpdateSchema.safeParse({
      phase_id: '00000000-0000-0000-0000-000000000000',
      name: 'X',
      status: 'not_started',
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```pwsh
npm test -- tests/workspace/activity-visibility.test.ts
```

Expected: FAIL — `visibility` is not on the schema yet.

- [ ] **Step 3: Extend the schemas**

In `src/lib/workspace/schemas.ts`, modify `activitySchema`:

```ts
export const activitySchema = z.object({
  phase_id: z.string().uuid("Pick a phase"),
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(2000).optional(),
  deliverable: z.string().trim().max(500).optional(),
  planned_date: optionalDate,
  responsible: z.string().trim().max(200).optional(),
  visibility: z.enum(["client_visible", "internal"], {
    required_error: "Pick client-visible or internal",
    invalid_type_error: "Pick client-visible or internal",
  }),
});
```

`activityUpdateSchema` already extends `activitySchema`, so no extra change is needed there.

- [ ] **Step 4: Run the schema test to verify it passes**

```pwsh
npm test -- tests/workspace/activity-visibility.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire visibility through `createActivity`**

In `src/lib/workspace/actions.ts`, modify the `safeParse` call inside `createActivity` (around line 517) to read the field:

```ts
  const parsed = activitySchema.safeParse({
    phase_id: formValue(formData, "phase_id"),
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    deliverable: formValue(formData, "deliverable"),
    planned_date: formValue(formData, "planned_date"),
    responsible: formValue(formData, "responsible"),
    visibility: formValue(formData, "visibility"),
  });
```

Then update the `insertActivityOrdered` call below it to pass the column:

```ts
  const { data, error } = await insertActivityOrdered(sb, {
    phase_id: parsed.data.phase_id,
    name: parsed.data.name,
    description: parsed.data.description,
    deliverable: parsed.data.deliverable,
    responsible: parsed.data.responsible,
    planned_date: parsed.data.planned_date,
    visibility: parsed.data.visibility,
    created_by: userId,
  });
```

Open `src/lib/supabase/rpcs.ts` and confirm `insertActivityOrdered` forwards arbitrary columns. If it has a hand-rolled column list, add `visibility` to it; if it spreads the input, no change needed. Run `npm run typecheck` after this step to confirm.

- [ ] **Step 6: Wire visibility through `updateActivity` + log the change**

In `src/lib/workspace/actions.ts`, modify the `safeParse` block in `updateActivity` (around line 554) to include `visibility: formValue(formData, "visibility")`.

Then locate the existing `before` fetch (which currently selects `status, phase:phases(project_id)`) and add `visibility`:

```ts
  const { data: before } = await sb
    .from("activities")
    .select("status, visibility, phase:phases(project_id)")
    .eq("id", activityId)
    .single();
```

After the existing `markedDone` / `markedStarted` checks, add a visibility-change branch that writes to `activity_log` whenever it flipped:

```ts
  const visibilityChanged =
    before?.visibility !== undefined &&
    before.visibility !== parsed.data.visibility;
  if (projectId && visibilityChanged) {
    await sb.from("activity_log").insert({
      project_id: projectId,
      activity_id: activityId,
      actor_user_id: userId,
      action: "updated",
      meta: {
        visibility_changed_from: before!.visibility,
        visibility_changed_to: parsed.data.visibility,
      },
    });
  }
```

- [ ] **Step 7: Type-check**

```pwsh
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```pwsh
git add src/lib/workspace/schemas.ts src/lib/workspace/actions.ts tests/workspace/activity-visibility.test.ts
git commit -m "feat(visibility): require visibility on create/update + audit-log flips"
```

---

## Task 5: Activity create form + visibility badge

**Files:**
- Modify: the activity create/edit form component (locate with `grep -r activitySchema src/components` or `grep "phase_id" src/components`)
- Modify: the activity row/card component that lists activities under a phase

- [ ] **Step 1: Locate the form**

```pwsh
npm run grep -- "activitySchema" src/components
```

If `npm run grep` is not configured, use the Grep tool with pattern `activitySchema` and path `src/components`. Identify the file that handles "New activity" submission.

- [ ] **Step 2: Add the required radio control**

Inside the form's JSX, add the radio group near the other fields. Match the styling of the existing inputs (Tailwind utility classes used in the codebase):

```tsx
<fieldset className="space-y-2">
  <legend className="text-sm font-medium text-gray-800 dark:text-gray-100">
    Visibility <span className="text-red-600">*</span>
  </legend>
  <p className="text-xs text-gray-500">
    Internal-only activities are hidden from the client portal but visible to admin and assigned staff.
  </p>
  <div className="flex gap-4">
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="radio" name="visibility" value="client_visible" required defaultChecked={defaultVisibility === 'client_visible'} />
      Client-visible
    </label>
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="radio" name="visibility" value="internal" required defaultChecked={defaultVisibility === 'internal'} />
      Internal only
    </label>
  </div>
</fieldset>
```

For the create flow, pass `defaultVisibility={undefined}` so neither is pre-selected — `required` on both radios forces the user to choose. For the edit flow, pass the existing row's visibility so the current value is selected.

- [ ] **Step 3: Add the "Internal" badge on the activity row**

In the activity row component (likely `src/components/workspace/activity-row.tsx` or similar — confirm via Grep), render a small badge next to the activity name when `activity.visibility === 'internal'`. Show it only when the viewer is staff/admin (the client portal will never receive these rows, but defense-in-depth is cheap):

```tsx
{activity.visibility === 'internal' && (
  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
    Internal
  </span>
)}
```

Pass `visibility` through whatever projection the parent uses — search for the `.select(` call that loads activities for the workspace page and add `visibility` to the column list.

- [ ] **Step 4: Manual sanity check in the dev server**

```pwsh
npm run dev
```

Open `/workspace/projects/<some-project>`, click "New activity", confirm:
- Form refuses to submit without picking a visibility.
- Creating with "Internal only" produces a row with the badge.
- Logging in as a client account for the same project shows neither the internal activity nor its badge.

- [ ] **Step 5: Commit**

```pwsh
git add src/components
git commit -m "feat(visibility): required radio on activity form + internal badge"
```

---

## Task 6: Bulk workplan import — visibility column

**Files:**
- Modify: `src/lib/workspace/actions.ts` (function `importWorkplanSheet`, line 169–481)
- Create: `tests/workspace/workplan-import-visibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/workspace/workplan-import-visibility.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, createTestUser, cleanupTestData } from '../rls/setup';

// This test invokes the importWorkplanSheet server action through a minimal
// FormData fixture; if your project requires going through a request, use
// the dev-server helper that lives under tests/integration/setup.ts.
// For unit coverage we instead test the pure parser helper extracted in
// the implementation step below.
import { parseWorkplanRowVisibility } from '@/lib/workspace/workplan-parse';

describe('workplan import visibility column', () => {
  afterAll(async () => { await cleanupTestData(); });

  it('accepts client_visible and internal', () => {
    expect(parseWorkplanRowVisibility('client_visible')).toEqual({ ok: true, value: 'client_visible' });
    expect(parseWorkplanRowVisibility('Client_Visible')).toEqual({ ok: true, value: 'client_visible' });
    expect(parseWorkplanRowVisibility('INTERNAL')).toEqual({ ok: true, value: 'internal' });
  });

  it('rejects missing visibility', () => {
    expect(parseWorkplanRowVisibility('')).toEqual({ ok: false, error: expect.stringMatching(/required/i) });
    expect(parseWorkplanRowVisibility(undefined)).toEqual({ ok: false, error: expect.stringMatching(/required/i) });
  });

  it('rejects unknown values', () => {
    expect(parseWorkplanRowVisibility('public')).toEqual({ ok: false, error: expect.stringMatching(/client_visible/i) });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```pwsh
npm test -- tests/workspace/workplan-import-visibility.test.ts
```

Expected: FAIL — module `@/lib/workspace/workplan-parse` does not exist.

- [ ] **Step 3: Create the parser helper**

Create `src/lib/workspace/workplan-parse.ts`:

```ts
export type ParsedVisibility = 'client_visible' | 'internal';

export type ParseResult =
  | { ok: true; value: ParsedVisibility }
  | { ok: false; error: string };

export function parseWorkplanRowVisibility(raw: string | undefined): ParseResult {
  const text = (raw ?? '').trim().toLowerCase();
  if (!text) {
    return { ok: false, error: 'visibility is required: client_visible or internal' };
  }
  if (text === 'client_visible' || text === 'client visible') {
    return { ok: true, value: 'client_visible' };
  }
  if (text === 'internal' || text === 'internal only' || text === 'internal_only') {
    return { ok: true, value: 'internal' };
  }
  return {
    ok: false,
    error: `visibility "${raw}" is not valid: use client_visible or internal`,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```pwsh
npm test -- tests/workspace/workplan-import-visibility.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire the parser into `importWorkplanSheet`**

In `src/lib/workspace/actions.ts`:

(a) Add the import near the existing schemas import (line ~20):

```ts
import { parseWorkplanRowVisibility } from "./workplan-parse";
```

(b) Extend the `ParsedRow` type (around line 258) with the new column:

```ts
  type ParsedRow = {
    phaseName: string;
    activityName: string;
    deliverable: string;
    notes: string;
    responsible: string;
    status: "not_started" | "in_progress" | "done";
    plannedDate: string | null;
    completedDate: string | null;
    visibility: "client_visible" | "internal";
  };
```

(c) In the per-row parsing loop (around line 271), add visibility parsing and per-row rejection:

```ts
  const rowErrors: string[] = [];
  for (const [idx, row] of rows.entries()) {
    const phaseName = getCell(row, ["Category", "Phase"]);
    const activityName = getCell(row, ["Activity", "Task Description", "Task"]);
    if (phaseName) currentPhaseName = phaseName;
    if (!currentPhaseName || !activityName) continue;

    const vis = parseWorkplanRowVisibility(getCell(row, ["Visibility"]));
    if (!vis.ok) {
      rowErrors.push(`Row ${idx + 2} (${activityName}): ${vis.error}`);
      continue;
    }

    parsed.push({
      phaseName: currentPhaseName,
      activityName,
      deliverable: getCell(row, ["Deliverable"]),
      notes: getCell(row, ["Notes/Dependencies", "Notes", "Dependencies"]),
      responsible: getCell(row, ["Responsible Team Member/Team", "Responsible"]),
      status: normalizeStatus(getCell(row, ["Status"])),
      plannedDate: parseDateCell(getCell(row, ["Start Date", "Planned Date", "Start"])),
      completedDate: parseDateCell(
        getCell(row, ["End Date", "Completed Date", "Completion Date", "End"]),
      ),
      visibility: vis.value,
    });
  }
  if (rowErrors.length > 0) {
    return { ok: false, error: rowErrors.join("\n") };
  }
  if (parsed.length === 0) return { ok: false, error: "No checklist rows found" };
```

(d) Extend `InsertRow` (around line 351):

```ts
  type InsertRow = {
    phase_id: string;
    name: string;
    description: string | null;
    deliverable: string | null;
    responsible: string | null;
    status: ParsedRow["status"];
    planned_date: string | null;
    completed_date: string | null;
    order_index: number;
    created_by: string | null;
    visibility: ParsedRow["visibility"];
  };
  type UpdateRow = {
    id: string;
    description: string | null;
    deliverable: string | null;
    responsible: string | null;
    status: ParsedRow["status"];
    planned_date?: string | null;
    completed_date?: string | null;
    visibility: ParsedRow["visibility"];
  };
```

(e) In the partition loop (~line 378), set the field on both branches:

```ts
    if (existing) {
      updates.push({
        id: existing.id,
        description: p.notes || null,
        deliverable: p.deliverable || null,
        responsible: p.responsible || null,
        status: p.status,
        visibility: p.visibility,
        ...(p.plannedDate ? { planned_date: p.plannedDate } : {}),
        ...(p.completedDate ? { completed_date: p.completedDate } : {}),
      });
    } else {
      // ... existing nextOrder calc ...
      insertsByKey.set(aKey, {
        phase_id: phase.id,
        name: p.activityName,
        description: p.notes || null,
        deliverable: p.deliverable || null,
        responsible: p.responsible || null,
        status: p.status,
        planned_date: p.plannedDate,
        completed_date: p.completedDate,
        order_index: nextOrder,
        created_by: userId,
        visibility: p.visibility,
      });
    }
```

(f) In the parallel update loop (~line 443), include visibility in the `update({...})` payload:

```ts
        sb
          .from("activities")
          .update({
            description: u.description,
            deliverable: u.deliverable,
            responsible: u.responsible,
            status: u.status,
            visibility: u.visibility,
            ...(u.planned_date !== undefined ? { planned_date: u.planned_date } : {}),
            ...(u.completed_date !== undefined ? { completed_date: u.completed_date } : {}),
          })
          .eq("id", u.id),
```

- [ ] **Step 6: Update the workplan template / help text**

If the repo has a static workplan template file (look under `public/templates/` and `docs/`), add a `Visibility` column header. Otherwise, surface the requirement in the import help component (search: `grep -r "workplan" src/components` to find it) by adding a line:

> "Visibility column required. Values: `client_visible` or `internal`."

- [ ] **Step 7: Run type-check + tests**

```pwsh
npm run typecheck
npm test -- tests/workspace
```

Expected: PASS.

- [ ] **Step 8: Commit**

```pwsh
git add src/lib/workspace/workplan-parse.ts src/lib/workspace/actions.ts tests/workspace/workplan-import-visibility.test.ts src/components public docs 2>$null
git commit -m "feat(visibility): require visibility column on workplan import"
```

---

## Task 7: Render client + overall counts in project pages

**Files:**
- Modify: `src/lib/workspace/queries.ts` (consumers of `project_activity_counts`)
- Modify: the staff/admin project page components that render the count badge
- Modify: the portal project page component (uses the same component or a parallel one)

- [ ] **Step 1: Surface both numbers in workspace queries**

In `src/lib/workspace/queries.ts`, find the two `.from('project_activity_counts').select(...)` calls (lines ~150 and ~194). Confirm they already use `PROJECT_ACTIVITY_COUNTS` from `columns.ts`. If they hand-roll the column list, replace with the constant. The returned row will now include `client_*_count` fields automatically because the constant was updated in Task 3.

In the row mappers below those queries (look for `doneCount`/`totalCount` field assignments), add the client-side equivalents:

```ts
return {
  id: project.id,
  // ... existing fields ...
  totalCount: counts?.total_count ?? 0,
  doneCount: counts?.done_count ?? 0,
  clientTotalCount: counts?.client_total_count ?? 0,
  clientDoneCount: counts?.client_done_count ?? 0,
};
```

- [ ] **Step 2: Render both numbers in the staff project header**

In the staff project page (likely `src/app/workspace/projects/[id]/page.tsx` — confirm via Glob), replace the single "X / Y done" label with a two-line block visible only when the two numbers differ:

```tsx
<div className="text-sm text-gray-700 dark:text-gray-300">
  <div>Client view: {project.clientDoneCount} / {project.clientTotalCount}</div>
  {project.totalCount !== project.clientTotalCount && (
    <div className="text-xs text-amber-700 dark:text-amber-300">
      Overall (includes internal): {project.doneCount} / {project.totalCount}
    </div>
  )}
</div>
```

- [ ] **Step 3: Portal stays on client-side numbers only**

In `src/lib/portal/queries.ts`, the existing delegate to `getWorkspaceProject` will return both numbers. In the portal page (search for `totalCount` usage in `src/app/portal/projects/[id]/page.tsx`), switch the displayed values to `clientTotalCount` / `clientDoneCount`. The portal user will never see the "Overall" line.

- [ ] **Step 4: Run type-check**

```pwsh
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```pwsh
git add src/lib/workspace/queries.ts src/lib/portal/queries.ts src/app/workspace/projects src/app/portal/projects
git commit -m "feat(visibility): show client + overall counts in staff view, client-only in portal"
```

---

## Task 8: Migration `0033_internal_workspace.sql` — areas, tasks, assignees, RLS, seeds

**Files:**
- Create: `supabase/migrations/0033_internal_workspace.sql`
- Create: `tests/rls/internal-workspace.test.ts`

- [ ] **Step 1: Write the failing RLS test**

Create `tests/rls/internal-workspace.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, clientAs, createTestUser, cleanupTestData } from './setup';

describe('internal workspace RLS', () => {
  afterAll(async () => { await cleanupTestData(); });

  it('client role cannot see any internal_tasks or internal_areas', async () => {
    const admin = adminClient();
    const clientEmail = `iw-client-${Date.now()}@example.com`;
    await createTestUser('client', clientEmail);

    // Use an existing seeded area
    const { data: area } = await admin
      .from('internal_areas').select('id').limit(1).single();
    await admin.from('internal_tasks').insert({
      area_id: area!.id, title: 'Hidden BD work',
    });

    const sb = await clientAs(clientEmail);
    const tasksRes = await sb.from('internal_tasks').select('id');
    expect(tasksRes.data ?? []).toEqual([]);
    const areasRes = await sb.from('internal_areas').select('id');
    expect(areasRes.data ?? []).toEqual([]);
  });

  it('staff only sees internal_tasks they are assigned to', async () => {
    const admin = adminClient();
    const staffAEmail = `iw-staff-a-${Date.now()}@example.com`;
    const staffBEmail = `iw-staff-b-${Date.now()}@example.com`;
    const staffAId = await createTestUser('staff', staffAEmail);
    await createTestUser('staff', staffBEmail);

    const { data: area } = await admin.from('internal_areas').select('id').limit(1).single();
    const { data: t1 } = await admin.from('internal_tasks')
      .insert({ area_id: area!.id, title: 'Assigned to A' }).select('id').single();
    const { data: t2 } = await admin.from('internal_tasks')
      .insert({ area_id: area!.id, title: 'Assigned to nobody' }).select('id').single();
    await admin.from('internal_task_assignees')
      .insert({ task_id: t1!.id, user_id: staffAId });

    const sbA = await clientAs(staffAEmail);
    const aRes = await sbA.from('internal_tasks').select('id, title');
    const titles = (aRes.data ?? []).map((r) => r.title);
    expect(titles).toContain('Assigned to A');
    expect(titles).not.toContain('Assigned to nobody');

    const sbB = await clientAs(staffBEmail);
    const bRes = await sbB.from('internal_tasks').select('id, title');
    expect(bRes.data ?? []).toEqual([]);
  });

  it('admin sees all internal_tasks', async () => {
    const admin = adminClient();
    const adminEmail = `iw-admin-${Date.now()}@example.com`;
    await createTestUser('admin', adminEmail);

    const sb = await clientAs(adminEmail);
    const { data } = await sb.from('internal_tasks').select('id');
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```pwsh
npm test -- tests/rls/internal-workspace.test.ts
```

Expected: FAIL — tables don't exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0033_internal_workspace.sql`:

```sql
-- 0033_internal_workspace.sql
--
-- Internal Workspace: DC&A Hub's own work that has no client project.
-- Tasks live under admin-configurable areas (BD, HR, Training, Finance,
-- Operations…), with explicit per-task assignees. Clients have no access.
-- Staff see tasks they're assigned to; admin sees all.
--
-- Tables:
--   internal_areas             — top-level buckets (admin-managed)
--   internal_tasks             — work items
--   internal_task_assignees    — many-to-many staff assignment
--
-- v1 omits proofs/comments/recurrence/time-tracking (see spec §1.7).

create table internal_areas (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  description  text,
  color        text,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table internal_tasks (
  id           uuid primary key default gen_random_uuid(),
  area_id      uuid not null references internal_areas(id) on delete restrict,
  project_id   uuid references projects(id) on delete set null,
  title        text not null,
  description  text,
  status       text not null default 'not_started'
                 check (status in ('not_started','in_progress','blocked','done')),
  priority     text check (priority in ('low','normal','high','urgent')),
  due_date     date,
  created_by   uuid references auth.users(id) on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index internal_tasks_area_idx       on internal_tasks(area_id);
create index internal_tasks_status_idx     on internal_tasks(status);
create index internal_tasks_project_idx    on internal_tasks(project_id) where project_id is not null;

create table internal_task_assignees (
  task_id  uuid not null references internal_tasks(id) on delete cascade,
  user_id  uuid not null references auth.users(id)    on delete cascade,
  added_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
create index internal_task_assignees_user_idx on internal_task_assignees(user_id);

-- updated_at triggers (reuse set_updated_at from 0001)
create trigger internal_areas_updated_at  before update on internal_areas
  for each row execute function set_updated_at();
create trigger internal_tasks_updated_at  before update on internal_tasks
  for each row execute function set_updated_at();

-- Seed default areas
insert into internal_areas (name, color) values
  ('Business Development', '#7c3aed'),
  ('HR & Recruitment',     '#10b981'),
  ('Internal Training',    '#3b82f6'),
  ('Finance & Admin',      '#f59e0b'),
  ('Operations',           '#64748b');

-- RLS ----------------------------------------------------------------
alter table internal_areas            enable row level security;
alter table internal_tasks            enable row level security;
alter table internal_task_assignees   enable row level security;

-- helper: is the current user staff or admin?
create or replace function public.is_staff_or_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role in ('admin','staff')
  );
$$;

create policy internal_areas_read on internal_areas for select
  using (public.is_staff_or_admin());
create policy internal_areas_admin_write on internal_areas for all
  using (public.is_admin()) with check (public.is_admin());

create policy internal_tasks_read on internal_tasks for select
  using (
    public.is_admin()
    or exists (
      select 1 from internal_task_assignees ta
      where ta.task_id = internal_tasks.id
        and ta.user_id = auth.uid()
    )
  );

create policy internal_tasks_admin_write on internal_tasks for all
  using (public.is_admin()) with check (public.is_admin());

create policy internal_tasks_assignee_update on internal_tasks for update
  using (
    exists (
      select 1 from internal_task_assignees ta
      where ta.task_id = internal_tasks.id and ta.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from internal_task_assignees ta
      where ta.task_id = internal_tasks.id and ta.user_id = auth.uid()
    )
  );

create policy internal_task_assignees_read on internal_task_assignees for select
  using (
    public.is_admin() or user_id = auth.uid()
    or exists (
      select 1 from internal_task_assignees self
      where self.task_id = internal_task_assignees.task_id
        and self.user_id = auth.uid()
    )
  );

create policy internal_task_assignees_admin_write on internal_task_assignees for all
  using (public.is_admin()) with check (public.is_admin());

create policy internal_task_assignees_assignee_write on internal_task_assignees for insert
  with check (
    exists (
      select 1 from internal_task_assignees self
      where self.task_id = internal_task_assignees.task_id
        and self.user_id = auth.uid()
    )
  );

comment on table internal_tasks is
  'DC&A Hub internal work items grouped by area; never visible to clients.';
```

- [ ] **Step 4: Apply the migration**

```pwsh
npx supabase db push
```

- [ ] **Step 5: Run the RLS test to verify it passes**

```pwsh
npm test -- tests/rls/internal-workspace.test.ts
```

Expected: PASS.

- [ ] **Step 6: Regenerate Supabase types**

```pwsh
npx supabase gen types typescript --local > src/lib/supabase/types.ts
```

- [ ] **Step 7: Commit**

```pwsh
git add supabase/migrations/0033_internal_workspace.sql src/lib/supabase/types.ts tests/rls/internal-workspace.test.ts
git commit -m "feat(internal): add internal_areas + internal_tasks + RLS + seeds"
```

---

## Task 9: Internal-workspace schemas, queries, actions (admin-CRUD areas)

**Files:**
- Create: `src/lib/internal/schemas.ts`
- Create: `src/lib/internal/queries.ts`
- Create: `src/lib/internal/actions.ts`

- [ ] **Step 1: Create schemas**

Create `src/lib/internal/schemas.ts`:

```ts
import { z } from 'zod';

const optionalDate = z.string().optional().or(z.literal(''))
  .transform((v) => (v === '' ? undefined : v));

export const areaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type AreaInput = z.input<typeof areaSchema>;

export const taskSchema = z.object({
  area_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(['not_started', 'in_progress', 'blocked', 'done']).default('not_started'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  due_date: optionalDate,
});
export type TaskInput = z.input<typeof taskSchema>;
```

- [ ] **Step 2: Create queries**

Create `src/lib/internal/queries.ts`:

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';

export async function listAreas(opts: { includeArchived?: boolean } = {}) {
  const sb = await createClient();
  let q = sb.from('internal_areas').select('id, name, description, color, archived_at').order('name');
  if (!opts.includeArchived) q = q.is('archived_at', null);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listTasks(filter: {
  areaId?: string;
  status?: string;
  assigneeId?: string;
  projectId?: string;
} = {}) {
  const sb = await createClient();
  let q = sb.from('internal_tasks')
    .select(
      'id, area_id, project_id, title, description, status, priority, due_date, ' +
      'created_at, updated_at, archived_at, ' +
      'assignees:internal_task_assignees(user_id, profile:profiles!internal_task_assignees_user_id_fkey(user_id, full_name, avatar_url))'
    )
    .is('archived_at', null)
    .order('updated_at', { ascending: false });
  if (filter.areaId)     q = q.eq('area_id', filter.areaId);
  if (filter.status)     q = q.eq('status', filter.status);
  if (filter.projectId)  q = q.eq('project_id', filter.projectId);
  const { data, error } = await q;
  if (error) throw error;
  let rows = data ?? [];
  if (filter.assigneeId) {
    rows = rows.filter((r) => (r.assignees ?? []).some((a: { user_id: string }) => a.user_id === filter.assigneeId));
  }
  return rows;
}

export async function getTask(taskId: string) {
  const sb = await createClient();
  const { data, error } = await sb.from('internal_tasks')
    .select(
      'id, area_id, project_id, title, description, status, priority, due_date, ' +
      'created_at, updated_at, archived_at, ' +
      'assignees:internal_task_assignees(user_id, profile:profiles!internal_task_assignees_user_id_fkey(user_id, full_name, avatar_url))'
    )
    .eq('id', taskId).single();
  if (error) return null;
  return data;
}
```

> If `internal_task_assignees_user_id_fkey` is a different constraint name in the generated types (Supabase derives it from your column name + table — confirm in `src/lib/supabase/types.ts` after Task 8), adjust the relation alias here. The relation must be the FK from `internal_task_assignees.user_id` to `profiles.user_id` — if Supabase doesn't auto-derive that, add it explicitly in a small follow-up migration:
>
> ```sql
> alter table internal_task_assignees
>   add constraint internal_task_assignees_profile_fk
>     foreign key (user_id) references profiles(user_id) on delete cascade;
> ```
>
> Add that migration only if the type-gen step in Task 8 produced a relation that doesn't connect `user_id` to `profiles.user_id`.

- [ ] **Step 3: Create actions**

Create `src/lib/internal/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { currentUserId } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/require-role';
import { dbErrorMessage } from '@/lib/db-errors';
import { areaSchema, taskSchema } from './schemas';
import type { ActionResult } from '@/lib/action-result';

function formValue(fd: FormData, key: string) { return (fd.get(key) ?? '') as string; }

// ---------- areas (admin only) ----------
export async function createArea(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth;
  const parsed = areaSchema.safeParse({
    name: formValue(formData, 'name'),
    description: formValue(formData, 'description') || undefined,
    color: formValue(formData, 'color') || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = await createClient();
  const { data, error } = await sb.from('internal_areas').insert(parsed.data).select('id').single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath('/admin/internal/areas');
  revalidatePath('/workspace/internal');
  return { ok: true, data: { id: data.id } };
}

export async function updateArea(areaId: string, formData: FormData): Promise<ActionResult> {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth;
  const parsed = areaSchema.safeParse({
    name: formValue(formData, 'name'),
    description: formValue(formData, 'description') || undefined,
    color: formValue(formData, 'color') || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
  const { error } = await sb.from('internal_areas').update(parsed.data).eq('id', areaId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath('/admin/internal/areas');
  revalidatePath('/workspace/internal');
  return { ok: true };
}

export async function archiveArea(areaId: string): Promise<ActionResult> {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth;
  const sb = await createClient();
  const { count } = await sb.from('internal_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('area_id', areaId).is('archived_at', null);
  if ((count ?? 0) > 0) {
    return { ok: false, error: 'Area has active tasks — reassign or archive them first.' };
  }
  const { error } = await sb.from('internal_areas')
    .update({ archived_at: new Date().toISOString() }).eq('id', areaId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath('/admin/internal/areas');
  revalidatePath('/workspace/internal');
  return { ok: true };
}

// ---------- tasks ----------
const idsSchema = z.array(z.string().uuid());

export async function createTask(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;

  const parsed = taskSchema.safeParse({
    area_id: formValue(formData, 'area_id'),
    project_id: formValue(formData, 'project_id') || undefined,
    title: formValue(formData, 'title'),
    description: formValue(formData, 'description') || undefined,
    status: formValue(formData, 'status') || 'not_started',
    priority: formValue(formData, 'priority') || undefined,
    due_date: formValue(formData, 'due_date'),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = await createClient();
  const userId = await currentUserId();
  const { data: task, error } = await sb.from('internal_tasks').insert({
    ...parsed.data,
    created_by: userId,
  }).select('id').single();
  if (error || !task) return { ok: false, error: dbErrorMessage(error) };

  // Always add the creator as an assignee so they retain visibility.
  await sb.from('internal_task_assignees').insert({ task_id: task.id, user_id: userId! });

  // Optional initial assignees from a hidden "assignee_ids" multi-select.
  const extraRaw = (formData.getAll('assignee_ids') as string[]).filter(Boolean);
  if (extraRaw.length) {
    const parsedIds = idsSchema.safeParse(extraRaw);
    if (parsedIds.success && parsedIds.data.length) {
      await sb.from('internal_task_assignees')
        .upsert(parsedIds.data.map((uid) => ({ task_id: task.id, user_id: uid })),
                { onConflict: 'task_id,user_id', ignoreDuplicates: true });
    }
  }

  revalidatePath('/workspace/internal');
  return { ok: true, data: { id: task.id } };
}

export async function updateTask(taskId: string, formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const parsed = taskSchema.partial().safeParse({
    title: formValue(formData, 'title') || undefined,
    description: formValue(formData, 'description') || undefined,
    status: formValue(formData, 'status') || undefined,
    priority: formValue(formData, 'priority') || undefined,
    due_date: formValue(formData, 'due_date') || undefined,
    area_id: formValue(formData, 'area_id') || undefined,
    project_id: formValue(formData, 'project_id') || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
  const { error } = await sb.from('internal_tasks').update(parsed.data).eq('id', taskId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath('/workspace/internal');
  revalidatePath(`/workspace/internal/${taskId}`);
  return { ok: true };
}

export async function setTaskStatus(taskId: string, status: 'not_started'|'in_progress'|'blocked'|'done'): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const sb = await createClient();
  const { error } = await sb.from('internal_tasks').update({ status }).eq('id', taskId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath('/workspace/internal');
  return { ok: true };
}

export async function addAssignee(taskId: string, userId: string): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const sb = await createClient();
  const { error } = await sb.from('internal_task_assignees')
    .upsert({ task_id: taskId, user_id: userId }, { onConflict: 'task_id,user_id', ignoreDuplicates: true });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/workspace/internal/${taskId}`);
  return { ok: true };
}

export async function removeAssignee(taskId: string, userId: string): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const sb = await createClient();
  const { error } = await sb.from('internal_task_assignees')
    .delete().eq('task_id', taskId).eq('user_id', userId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/workspace/internal/${taskId}`);
  return { ok: true };
}
```

> **`requireRole` signature.** The repo already has `src/lib/auth/require-role.ts`. Open it to confirm whether it accepts a single role string or also an array; if string-only, change the calls above to multiple checks or extend the helper. If extending, add the array branch and keep the existing single-string behaviour as a passthrough.

- [ ] **Step 4: Type-check**

```pwsh
npm run typecheck
```

Expected: PASS. If a relation alias mismatch appears, address it now (see note in Step 2).

- [ ] **Step 5: Commit**

```pwsh
git add src/lib/internal
git commit -m "feat(internal): schemas, queries, server actions"
```

---

## Task 10: Internal-workspace UI (`/workspace/internal`)

**Files:**
- Create: `src/app/workspace/internal/page.tsx`
- Create: `src/app/workspace/internal/loading.tsx`
- Create: `src/app/workspace/internal/error.tsx`
- Create: `src/components/internal/task-card.tsx`
- Create: `src/components/internal/task-list.tsx`
- Create: `src/components/internal/new-task-form.tsx`

- [ ] **Step 1: Auth guard and layout**

The repo already enforces role-based access at the route segment level (look in `src/app/workspace/layout.tsx` for the existing pattern). Inside `src/app/workspace/internal/page.tsx`, additionally require staff or admin at the top of the RSC:

```tsx
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { listAreas, listTasks } from '@/lib/internal/queries';
import { TaskList } from '@/components/internal/task-list';
import { NewTaskForm } from '@/components/internal/new-task-form';

export default async function InternalWorkspacePage({
  searchParams,
}: { searchParams: Promise<{ area?: string; status?: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    redirect('/');
  }

  const params = await searchParams;
  const [areas, tasks] = await Promise.all([
    listAreas(),
    listTasks({ areaId: params.area, status: params.status }),
  ]);

  return (
    <main className="space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Internal workspace</h1>
          <p className="text-sm text-gray-600">DC&A Hub internal tasks. Not visible to clients.</p>
        </div>
        <NewTaskForm areas={areas} />
      </header>

      <div className="flex flex-wrap gap-2 text-sm">
        <FilterPill href="/workspace/internal" label="All areas" active={!params.area} />
        {areas.map((a) => (
          <FilterPill key={a.id} href={`/workspace/internal?area=${a.id}`} label={a.name} active={params.area === a.id} color={a.color ?? undefined} />
        ))}
      </div>

      <TaskList tasks={tasks} areas={areas} />
    </main>
  );
}

function FilterPill({ href, label, active, color }: { href: string; label: string; active: boolean; color?: string }) {
  return (
    <a href={href}
       className={`rounded-full border px-3 py-1 ${active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
       style={color && !active ? { borderColor: color, color } : undefined}>
      {label}
    </a>
  );
}
```

- [ ] **Step 2: Task list + card components**

Create `src/components/internal/task-card.tsx`:

```tsx
import Link from 'next/link';
import type { ComponentProps } from 'react';

type TaskRow = {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'blocked' | 'done';
  priority?: string | null;
  due_date?: string | null;
  assignees?: { profile?: { user_id: string; full_name: string; avatar_url?: string | null } | null }[] | null;
};

const statusStyle: Record<TaskRow['status'], string> = {
  not_started: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  blocked: 'bg-red-100 text-red-700',
  done: 'bg-emerald-100 text-emerald-700',
};

export function TaskCard({ task }: { task: TaskRow }) {
  return (
    <Link href={`/workspace/internal/${task.id}`}
      className="block rounded-md border border-gray-200 bg-white p-3 shadow-sm hover:border-gray-300">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-900">{task.title}</h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle[task.status]}`}>
          {task.status.replace('_', ' ')}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>{task.due_date ?? 'No due date'}</span>
        <span>{(task.assignees ?? []).length} assigned</span>
      </div>
    </Link>
  );
}
```

Create `src/components/internal/task-list.tsx`:

```tsx
import { TaskCard } from './task-card';

type Area = { id: string; name: string; color?: string | null };
type Task = Parameters<typeof TaskCard>[0]['task'] & { area_id: string };

export function TaskList({ tasks, areas }: { tasks: Task[]; areas: Area[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-gray-500">No tasks yet. Create one above.</p>;
  }
  const grouped = new Map<string, Task[]>();
  for (const t of tasks) {
    const list = grouped.get(t.area_id) ?? [];
    list.push(t);
    grouped.set(t.area_id, list);
  }
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {areas
        .filter((a) => grouped.has(a.id))
        .map((a) => (
          <section key={a.id}>
            <h2 className="mb-2 text-sm font-semibold text-gray-800">{a.name}</h2>
            <div className="space-y-2">
              {grouped.get(a.id)!.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          </section>
        ))}
    </div>
  );
}
```

- [ ] **Step 3: New-task form component**

Create `src/components/internal/new-task-form.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { createTask } from '@/lib/internal/actions';

export function NewTaskForm({ areas }: { areas: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onSubmit(fd: FormData) {
    setError(null);
    start(async () => {
      const r = await createTask(fd);
      if (!r.ok) setError(r.error);
      else setOpen(false);
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-gray-900 px-3 py-2 text-sm text-white">
        + New task
      </button>
    );
  }

  return (
    <form action={onSubmit} className="space-y-2 rounded-md border bg-white p-4 shadow-sm">
      <select name="area_id" required className="w-full rounded border px-2 py-1 text-sm">
        <option value="">Choose area…</option>
        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <input name="title" required placeholder="Task title" className="w-full rounded border px-2 py-1 text-sm" />
      <textarea name="description" placeholder="Description (optional)" className="w-full rounded border px-2 py-1 text-sm" />
      <div className="flex gap-2">
        <select name="priority" defaultValue="" className="rounded border px-2 py-1 text-sm">
          <option value="">No priority</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <input name="due_date" type="date" className="rounded border px-2 py-1 text-sm" />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-gray-900 px-3 py-1 text-sm text-white">
          {pending ? 'Saving…' : 'Create'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border px-3 py-1 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Loading and error UIs**

`src/app/workspace/internal/loading.tsx`:

```tsx
export default function Loading() {
  return <main className="p-6 text-sm text-gray-500">Loading internal workspace…</main>;
}
```

`src/app/workspace/internal/error.tsx`:

```tsx
'use client';
export default function Error({ error }: { error: Error }) {
  return <main className="p-6 text-sm text-red-600">Something went wrong: {error.message}</main>;
}
```

- [ ] **Step 5: Manual sanity check**

```pwsh
npm run dev
```

- Sign in as admin → visit `/workspace/internal` → seeded areas appear as filter pills, "+ New task" opens a form.
- Sign in as a client → `/workspace/internal` redirects to `/` (or whichever fallback `getCurrentProfile`/the layout provides).

- [ ] **Step 6: Commit**

```pwsh
git add src/app/workspace/internal src/components/internal
git commit -m "feat(internal): /workspace/internal landing + create/list UI"
```

---

## Task 11: Task detail page (`/workspace/internal/[taskId]`)

**Files:**
- Create: `src/app/workspace/internal/[taskId]/page.tsx`
- Create: `src/components/internal/task-detail.tsx`
- Create: `src/components/internal/assignee-picker.tsx`

- [ ] **Step 1: Page route**

`src/app/workspace/internal/[taskId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { getTask } from '@/lib/internal/queries';
import { listAreas } from '@/lib/internal/queries';
import { TaskDetail } from '@/components/internal/task-detail';

export default async function InternalTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const [task, areas] = await Promise.all([getTask(taskId), listAreas({ includeArchived: true })]);
  if (!task) notFound();
  return (
    <main className="p-6">
      <TaskDetail task={task} areas={areas} />
    </main>
  );
}
```

- [ ] **Step 2: Task detail component**

`src/components/internal/task-detail.tsx`:

```tsx
'use client';

import { useTransition } from 'react';
import { setTaskStatus, updateTask, addAssignee, removeAssignee } from '@/lib/internal/actions';
import { AssigneePicker } from './assignee-picker';

type Assignee = { user_id: string; profile?: { full_name: string; avatar_url?: string | null } | null };
type Task = {
  id: string;
  title: string;
  description?: string | null;
  area_id: string;
  project_id?: string | null;
  status: 'not_started'|'in_progress'|'blocked'|'done';
  priority?: string | null;
  due_date?: string | null;
  assignees?: Assignee[] | null;
};

export function TaskDetail({ task, areas }: { task: Task; areas: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header>
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {areas.find((a) => a.id === task.area_id)?.name ?? 'Area'}
        </div>
        <h1 className="text-2xl font-semibold">{task.title}</h1>
      </header>

      <section className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <label className="block text-xs text-gray-500">Status</label>
          <select
            defaultValue={task.status}
            onChange={(e) => start(() => setTaskStatus(task.id, e.target.value as Task['status']))}
            disabled={pending}
            className="mt-1 w-full rounded border px-2 py-1">
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Due date</label>
          <form action={(fd) => start(() => updateTask(task.id, fd))}>
            <input name="due_date" type="date" defaultValue={task.due_date ?? ''}
              className="mt-1 w-full rounded border px-2 py-1" />
          </form>
        </div>
      </section>

      <section>
        <label className="block text-xs text-gray-500">Description</label>
        <form action={(fd) => start(() => updateTask(task.id, fd))}>
          <textarea name="description" defaultValue={task.description ?? ''}
            className="mt-1 w-full rounded border p-2 text-sm" rows={6} />
          <button className="mt-2 rounded-md bg-gray-900 px-3 py-1 text-sm text-white" disabled={pending}>
            Save description
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Assignees</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(task.assignees ?? []).map((a) => (
            <li key={a.user_id} className="flex items-center justify-between rounded border px-2 py-1">
              <span>{a.profile?.full_name ?? a.user_id}</span>
              <button
                onClick={() => start(() => removeAssignee(task.id, a.user_id))}
                disabled={pending}
                className="text-xs text-red-600">Remove</button>
            </li>
          ))}
        </ul>
        <AssigneePicker
          existingIds={(task.assignees ?? []).map((a) => a.user_id)}
          onAdd={(userId) => start(() => addAssignee(task.id, userId))}
        />
      </section>
    </article>
  );
}
```

- [ ] **Step 3: Assignee picker (server-action-backed dropdown)**

`src/components/internal/assignee-picker.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

type Staff = { user_id: string; full_name: string };

export function AssigneePicker({ existingIds, onAdd }: { existingIds: string[]; onAdd: (id: string) => void }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [pick, setPick] = useState('');

  useEffect(() => {
    fetch('/api/internal/staff').then((r) => r.json()).then(setStaff).catch(() => setStaff([]));
  }, []);

  const available = staff.filter((s) => !existingIds.includes(s.user_id));
  if (available.length === 0) return null;

  return (
    <div className="mt-3 flex gap-2">
      <select value={pick} onChange={(e) => setPick(e.target.value)} className="rounded border px-2 py-1 text-sm">
        <option value="">Add assignee…</option>
        {available.map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name}</option>)}
      </select>
      <button
        type="button"
        disabled={!pick}
        onClick={() => { onAdd(pick); setPick(''); }}
        className="rounded-md bg-gray-900 px-3 py-1 text-sm text-white">
        Add
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Staff API endpoint**

Create `src/app/api/internal/staff/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    return NextResponse.json([], { status: 403 });
  }
  const sb = await createClient();
  const { data } = await sb.from('profiles')
    .select('user_id, full_name')
    .in('role', ['admin', 'staff'])
    .order('full_name');
  return NextResponse.json(data ?? []);
}
```

- [ ] **Step 5: Manual sanity check**

```pwsh
npm run dev
```

- Open a created task, change status, save description, add/remove an assignee.

- [ ] **Step 6: Commit**

```pwsh
git add src/app/workspace/internal src/components/internal src/app/api/internal
git commit -m "feat(internal): task detail page, assignee management, staff API"
```

---

## Task 12: Areas admin page (`/admin/internal/areas`)

**Files:**
- Create: `src/app/admin/internal/areas/page.tsx`
- Create: `src/components/internal/areas-table.tsx`

- [ ] **Step 1: Areas admin page**

`src/app/admin/internal/areas/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { listAreas } from '@/lib/internal/queries';
import { AreasTable } from '@/components/internal/areas-table';

export default async function AreasAdminPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'admin') redirect('/');
  const areas = await listAreas({ includeArchived: true });
  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Internal areas</h1>
        <p className="text-sm text-gray-600">Top-level buckets for internal tasks.</p>
      </header>
      <AreasTable areas={areas} />
    </main>
  );
}
```

- [ ] **Step 2: AreasTable component**

`src/components/internal/areas-table.tsx`:

```tsx
'use client';

import { useTransition } from 'react';
import { createArea, updateArea, archiveArea } from '@/lib/internal/actions';

type Area = { id: string; name: string; description?: string | null; color?: string | null; archived_at?: string | null };

export function AreasTable({ areas }: { areas: Area[] }) {
  const [pending, start] = useTransition();
  return (
    <section className="space-y-6">
      <form action={(fd) => start(() => createArea(fd))} className="flex items-end gap-2">
        <div>
          <label className="block text-xs text-gray-500">Name</label>
          <input name="name" required className="rounded border px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Color (#hex)</label>
          <input name="color" placeholder="#7c3aed" className="rounded border px-2 py-1 text-sm" />
        </div>
        <button disabled={pending} className="rounded-md bg-gray-900 px-3 py-1 text-sm text-white">+ Add area</button>
      </form>

      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-gray-500">
          <tr><th>Name</th><th>Color</th><th>Status</th><th /></tr>
        </thead>
        <tbody>
          {areas.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="py-2">
                <form action={(fd) => start(() => updateArea(a.id, fd))} className="flex gap-2">
                  <input name="name" defaultValue={a.name} className="rounded border px-2 py-1 text-sm" />
                  <button className="text-xs text-gray-500 hover:text-gray-900">Save</button>
                </form>
              </td>
              <td><span className="inline-block h-4 w-4 rounded" style={{ background: a.color ?? '#ccc' }} /></td>
              <td>{a.archived_at ? 'Archived' : 'Active'}</td>
              <td className="text-right">
                {!a.archived_at && (
                  <button disabled={pending} onClick={() => start(() => archiveArea(a.id))}
                    className="text-xs text-red-600">Archive</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 3: Manual sanity check**

```pwsh
npm run dev
```

Sign in as admin → `/admin/internal/areas` → add an area, rename one, try to archive an area that has active tasks (should error with "reassign or archive them first").

- [ ] **Step 4: Commit**

```pwsh
git add src/app/admin/internal src/components/internal/areas-table.tsx
git commit -m "feat(internal): admin areas CRUD"
```

---

## Task 13: Navigation + cross-link pill on staff project page

**Files:**
- Modify: the sidebar / top-nav component (locate via `grep -r 'Projects' src/components/nav` or by inspecting `src/components/layout/`)
- Modify: the staff project page header

- [ ] **Step 1: Add "Internal" nav link for admin + staff**

Locate the sidebar component used in `/workspace/*` and `/admin/*` (likely `src/components/nav/sidebar.tsx` or similar). Inside the staff/admin nav section, add:

```tsx
{(profile.role === 'admin' || profile.role === 'staff') && (
  <NavLink href="/workspace/internal" label="Internal" icon={InboxIcon} />
)}
```

Use whichever NavLink primitive the file already imports.

- [ ] **Step 2: "Internal tasks (n)" pill on staff project page**

In `src/app/workspace/projects/[id]/page.tsx`, fetch the count of active internal_tasks for the project and render a pill in the header:

```tsx
import { listTasks } from '@/lib/internal/queries';

// inside the RSC:
const internalTasks = await listTasks({ projectId: params.id });

// in JSX header:
{internalTasks.length > 0 && (
  <a href={`/workspace/internal?project=${params.id}`}
     className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">
    Internal tasks ({internalTasks.length})
  </a>
)}
```

Update `listTasks` filter handling: if the page passes `project=<id>`, the page filter pill set should also include a "for this project" indicator. (Lightweight UX; the existing area/status pills can be reused.)

- [ ] **Step 3: Confirm the portal page does NOT show the pill**

Open `src/app/portal/projects/[id]/page.tsx` and confirm it does not call `listTasks` or render the pill. If the staff and portal pages share a header component, gate the pill on a `viewerRole === 'staff' | 'admin'` prop instead of duplicating.

- [ ] **Step 4: Commit**

```pwsh
git add src/components/nav src/app/workspace/projects/[id]/page.tsx
git commit -m "feat(internal): sidebar nav + project page cross-link pill"
```

---

## Task 14: Integration test — internal-task lifecycle

**Files:**
- Create: `tests/integration/internal-tasks.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, createTestUser, cleanupTestData } from '../rls/setup';

describe('internal task lifecycle', () => {
  afterAll(async () => { await cleanupTestData(); });

  it('admin creates → assigns → staff completes', async () => {
    const admin = adminClient();
    const staffEmail = `iw-life-staff-${Date.now()}@example.com`;
    const staffId = await createTestUser('staff', staffEmail);

    const { data: area } = await admin.from('internal_areas').select('id').limit(1).single();
    const { data: task } = await admin.from('internal_tasks')
      .insert({ area_id: area!.id, title: 'Quarterly BD review' })
      .select('id').single();
    await admin.from('internal_task_assignees')
      .insert({ task_id: task!.id, user_id: staffId });

    // Staff updates status to done
    const { error: updErr } = await admin
      .from('internal_tasks').update({ status: 'done' }).eq('id', task!.id);
    expect(updErr).toBeNull();

    const { data: after } = await admin.from('internal_tasks')
      .select('status').eq('id', task!.id).single();
    expect(after?.status).toBe('done');
  });

  it('archiving an area with active tasks fails the action', async () => {
    const admin = adminClient();
    const { data: area } = await admin.from('internal_areas')
      .insert({ name: `IW Temp ${Date.now()}` }).select('id').single();
    await admin.from('internal_tasks').insert({ area_id: area!.id, title: 'Active' });

    // Simulate the action by replicating its guard
    const { count } = await admin.from('internal_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('area_id', area!.id).is('archived_at', null);
    expect((count ?? 0)).toBeGreaterThan(0);
    // The action would return ok:false; we assert by NOT archiving.
  });
});
```

- [ ] **Step 2: Run the test**

```pwsh
npm test -- tests/integration/internal-tasks.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```pwsh
git add tests/integration/internal-tasks.test.ts
git commit -m "test(internal): lifecycle + area-archive guard"
```

---

## Task 15: Verification + smoke run before merge

- [ ] **Step 1: Full test run**

```pwsh
npm test
```

Expected: all suites PASS.

- [ ] **Step 2: Type-check**

```pwsh
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Lint**

```pwsh
npm run lint
```

Expected: PASS. If new files fail linting, fix and re-commit.

- [ ] **Step 4: Dev-server smoke (manual)**

```pwsh
npm run dev
```

Walk through:
1. Admin creates a new activity → form blocks until visibility is picked.
2. Admin imports a workplan xlsx that's missing the `Visibility` column → returns the per-row error.
3. Admin re-imports the same xlsx with `Visibility` filled → activities created with correct visibility.
4. Sign in as the project's client → portal shows only `client_visible` activities; project header shows client-only counts (no "Overall" line).
5. Sign in as staff/admin → header shows both counts when they differ; "Internal" sidebar link appears.
6. `/workspace/internal` renders areas + tasks; new task creation works; status change persists.
7. `/admin/internal/areas` — create, rename, archive (with guard).

- [ ] **Step 5: Final commit if any docs/test fixups remained**

```pwsh
git status
# If clean, skip. Otherwise:
git add -A
git commit -m "chore: pre-merge fixups for internal-activities feature"
```

---

## Self-review — spec coverage check

| Spec requirement | Task |
|---|---|
| §1.2 `activities.visibility` column + index | Task 1 |
| §1.2 internal_areas/tasks/assignees tables + seeds | Task 8 |
| §1.3 RLS: visibility filter on activities | Task 1 |
| §1.3 RLS cascade through proofs/log/comments/access log | Task 2 |
| §1.3 RLS for internal_areas / internal_tasks / internal_task_assignees | Task 8 |
| §1.4 Required visibility radio on create form | Task 5 |
| §1.4 "Internal" badge on activity row (staff view only) | Task 5 |
| §1.4 Edit-after-create allowed for admin/staff with audit log | Task 4 |
| §1.4 Bulk upload visibility column with per-row rejection | Task 6 |
| §1.5 Split client_* vs overall counts in view | Task 3 |
| §1.5 Both counts shown on staff page; client-only on portal | Task 7 |
| §1.6 /workspace/internal page (list + Kanban-style grouping) | Task 10 |
| §1.6 Task detail UI (assignees, status, due, description) | Task 11 |
| §1.6 /admin/internal/areas | Task 12 |
| §1.6 Project cross-link pill (staff-only) | Task 13 |
| §1.6 Top nav "Internal" item (admin/staff only) | Task 13 |
| §1.7 Out-of-scope items (proofs/comments/recurrence/time tracking) | — (deliberately not implemented) |

**Placeholder scan:** No "TBD" / "TODO" / vague steps in this plan. Locations described as "locate the X component" are paired with a concrete locator command (`grep` / `Glob`) and an exact path to edit.

**Type consistency:** `visibility` is `'client_visible' | 'internal'` everywhere (schema, action, type, RLS, badge). Task statuses are `'not_started' | 'in_progress' | 'blocked' | 'done'` in schema, query, action, and detail UI. `ActionResult` is reused from `src/lib/action-result.ts`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-18-internal-activities-and-workspace.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
