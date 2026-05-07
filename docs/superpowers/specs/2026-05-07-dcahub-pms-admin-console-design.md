# DC&A Hub PMS — Plan 2: Admin Console Design Spec

**Date:** 2026-05-07
**Status:** Approved (pending user review of written spec)
**Authors:** Ishmael + Claude
**Parent spec:** `docs/superpowers/specs/2026-05-06-dcahub-pms-design.md`

## 1. Goal

Ship a working admin console for DC&A Hub PMS so the admin (Ishmael) can:

- Create and archive client organisations
- Create and archive project shells (no phases/activities yet)
- Assign DC&A Hub staff to projects as `member`s
- Invite client viewers by email and grant them `viewer` access to a single project
- List, invite, and manage all users (change global role, deactivate)
- See an org-wide overview at `/admin`

This is **Plan 2** in the four-plan rollout. Plan 1 (Foundation) is complete. Plan 3 (Workspace + Activity Flow) and Plan 4 (Client Portal + Notifications) follow.

## 2. Out of scope

- Anything *inside* a project (phases, activities, proofs) — Plan 3
- Email notifications on activity completion — Plan 4
- Bulk user import, CSV export, audit-log UI
- Custom email templates / branded sending domain (uses Supabase default email for v1)
- E2E browser tests (manual smoke only)

## 3. Decisions locked during brainstorming

| # | Question | Decision |
|---|---|---|
| 1 | User invitation mechanism | Supabase magic-link invite (`auth.admin.inviteUserByEmail`) with profile pre-creation. Invitee sets their own password via `/reset-password`. |
| 2 | Admin layout | Persistent left sidebar (shadcn `Sidebar` primitive) applied via `app/admin/layout.tsx`. |
| 3 | Forms stack | `react-hook-form` + `zod` + shadcn `Form` components. Same zod schema validates client-side and inside the server action. |
| 4 | Delete semantics | Archive only — `archived_at timestamptz` on `clients` and `projects`; `is_active boolean` on `profiles`. No hard delete in v1. |

## 4. Schema changes

One new migration: `supabase/migrations/0005_archive_and_active.sql`.

```sql
alter table clients  add column archived_at timestamptz;
alter table projects add column archived_at timestamptz;
alter table profiles add column is_active boolean not null default true;

create index on clients  (archived_at) where archived_at is null;
create index on projects (archived_at) where archived_at is null;
```

**RLS updates:** existing non-admin SELECT policies extended so they ignore rows where `archived_at is not null`. Admin policies unchanged (admin sees archived rows; UI provides a "Show archived" toggle).

**Type regen:** rerun `supabase gen types typescript --project-id oywamynxpmdshhzgxnen` and overwrite `src/lib/supabase/types.ts`.

No other tables, columns, or indexes change in Plan 2.

## 5. Routes & file layout

```
src/
├── app/
│   └── admin/
│       ├── layout.tsx                    # AdminShell wrapper (sidebar + main)
│       ├── page.tsx                      # /admin overview
│       ├── clients/
│       │   ├── page.tsx                  # list
│       │   ├── new/page.tsx              # create form
│       │   └── [id]/page.tsx             # edit + archive
│       ├── projects/
│       │   ├── page.tsx                  # list
│       │   ├── new/page.tsx              # create form
│       │   └── [id]/
│       │       ├── page.tsx              # edit meta + archive
│       │       └── team/page.tsx         # members + invite client viewer
│       └── users/
│           ├── page.tsx                  # list + invite
│           └── [id]/page.tsx             # edit role / deactivate
├── components/
│   └── admin/
│       ├── admin-shell.tsx               # sidebar + topbar
│       ├── archive-toggle.tsx            # "Show archived" switch
│       ├── data-table.tsx                # thin shadcn Table wrapper
│       └── forms/
│           ├── client-form.tsx
│           ├── project-form.tsx
│           ├── invite-user-form.tsx
│           └── assign-member-form.tsx
├── lib/
│   ├── admin/
│   │   ├── actions/
│   │   │   ├── clients.ts                # create / update / archive / restore
│   │   │   ├── projects.ts
│   │   │   ├── members.ts                # add / remove project_members
│   │   │   └── users.ts                  # invite / set role / deactivate
│   │   ├── schemas.ts                    # zod schemas (shared by form + action)
│   │   └── queries.ts                    # typed read helpers
│   └── supabase/
│       └── admin-invites.ts              # wraps auth.admin.inviteUserByEmail
└── supabase/
    └── migrations/
        └── 0005_archive_and_active.sql
```

### Conventions

- **Server actions** live in `src/lib/admin/actions/`, one file per resource. Each action calls `revalidatePath` on success and returns `{ error: string } | { ok: true; ... }` on failure.
- **Zod schemas** in `schemas.ts` are imported by the client form (via `@hookform/resolvers/zod`) and by the matching server action (re-validates before any DB write).
- **Layout guard:** `app/admin/layout.tsx` calls `getCurrentProfile()` (from Plan 1) and returns a 403-style page if `role !== 'admin'`. Defence in depth — `src/proxy.ts` already blocks non-admins, this catches any direct render.
- **Active nav highlight:** `admin-shell.tsx` reads `usePathname()` to mark the current section.

## 6. Key flows

### 6.1 Invite a user (admin → staff or client)

1. Admin opens `/admin/users`, clicks **Invite**.
2. Form fields: email (required, valid email), full name (optional), global role (`staff | client`).
3. Server action `inviteUser`:
   - Validates with zod
   - Calls `supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: <NEXT_PUBLIC_APP_URL>/reset-password })`
   - On success, inserts a row into `profiles (user_id, email, full_name, role)` with the chosen role
   - If the profile insert fails after the auth invite was already sent, the action logs the failure to `activity_log.meta` and surfaces an error to the admin. The auth user is harmless to leave; admin can retry profile creation from the failure UI.
4. Invitee receives a Supabase-sent email, clicks the link, sets a password, and is routed by `src/proxy.ts` to `/admin`, `/workspace`, or `/portal` based on `profiles.role`.

### 6.2 Assign a staff member to a project

1. Admin on `/admin/projects/[id]/team` sees the current member list and an **Add member** button.
2. The form is a combobox of users with `profiles.role in ('admin','staff')` and `is_active = true` who are not already members of this project.
3. Server action `addProjectMember(projectId, userId)` inserts `project_members (project_id, user_id, project_role='member')`.
4. **Removing** a member deletes the `project_members` row outright. Membership is a permission grant, not data — no soft-delete.

### 6.3 Invite a client viewer to a project

A client viewer is always tied to one project (per spec §4 of parent spec). Two paths:

- **Existing client user:** combobox flow (same as 6.2 but filtered to `role = 'client'` and `project_role = 'viewer'`).
- **New client user:** **Invite client viewer** button on `/admin/projects/[id]/team` opens an email form. The single server action `inviteClientViewer(projectId, email, fullName)`:
  1. Calls `inviteUser` internally with `role = 'client'`
  2. Calls `addProjectMember(projectId, newUserId, 'viewer')` in the same action
  3. If step 2 fails after step 1 succeeded, the error is surfaced; the admin retries member-add from `/admin/users/[id]`. The orphaned client user is harmless (they can log in but see no projects).

### 6.4 Archive vs restore

- All list pages default to `archived_at is null`.
- `<ArchiveToggle/>` flips the query to include archived rows. Archived rows render with muted styling and a **Restore** button.
- **Archive** sets `archived_at = now()`; **Restore** sets it back to `null`.
- Archiving a client does **not** cascade to its projects. If the client has any active (non-archived) projects, the archive form shows a warning: "*N* active project(s) under this client will keep running. Archive them too?" with a checkbox to also archive all child projects in the same action. Default is unchecked.

### 6.5 Deactivate a user

- `/admin/users/[id]` shows a **Deactivate** button.
- Server action `deactivateUser(userId)`:
  1. Sets `profiles.is_active = false`
  2. Calls `supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })` — Supabase's idiom for indefinite ban; revokes existing sessions.
- **Reactivate** reverses both.
- Deactivated users are hidden from member-assignment comboboxes but still appear on `/admin/users` with an "Inactive" badge.
- An admin cannot deactivate themselves (server action rejects if `userId === auth.uid()`).

### 6.6 Admin overview (`/admin`)

Three cards plus a feed:

- **Active projects** count (`projects` where `archived_at is null and status != 'completed'`)
- **Total users** count (`profiles` where `is_active = true`), with a sub-line of recent invites in the last 7 days
- **Clients** count (`clients` where `archived_at is null`)
- **Recent activity feed:** last 10 rows from `activity_log` joined to `projects.name` and `profiles.full_name`, newest first

## 7. Testing strategy

Same shape as Plan 1: Vitest, with integration tests hitting the live Supabase project.

### Unit tests (pure, fast)
- `src/lib/admin/schemas.test.ts` — every zod schema accepts valid input and rejects each invalid case (empty name, bad email, invalid role, etc.). One `describe` block per schema.

### Integration tests (live Supabase)
- `tests/integration/admin-actions.test.ts`:
  - Create client → archive → restore → list filters correctly
  - Create project under client → archive → list filters
  - Invite user → row exists in `auth.users` and `profiles` with correct role
  - Add member → `project_members` row exists; remove → row gone
  - Deactivate user → `is_active = false` and Supabase reports user banned
  - `inviteClientViewer` happy path: user exists + `project_members` row exists with `project_role='viewer'`
- `tests/integration/admin-rls.test.ts` — extends Plan 1's RLS tests:
  - Non-admin user calling each admin action is rejected by RLS
  - Archived projects/clients are hidden from non-admin reads
  - Inactive users cannot sign in (verify via Supabase auth response)

### Manual smoke test
At the end of Plan 2, walk through the full flow in a browser:
1. Log in as admin → invite a staff user (note email)
2. Invite a client user
3. Create a client organisation, then a project under it
4. Assign the staff user to the project; invite the client as viewer
5. Log out, log in as staff → confirm `/workspace` is reachable, `/admin` is not, project appears in their list
6. Log out, log in as client → confirm `/portal` is reachable, project appears, no other surfaces accessible

**Coverage target:** every server action has at least one happy-path integration test and one auth-rejection test.

## 8. Task breakdown (high-level)

The implementation plan (written next) will sequence roughly:

1. Schema migration `0005_archive_and_active.sql` + regen TS types
2. Extend RLS so non-admin reads ignore archived rows
3. `AdminShell` layout + sidebar + admin guard
4. Zod schemas + unit tests
5. Clients CRUD (list, create, edit, archive/restore) + tests
6. Projects CRUD (list, create, edit, archive/restore) + tests
7. Users — list + invite + tests
8. Users — change role + deactivate/reactivate + tests
9. Project team page — add/remove member + invite client viewer + tests
10. Admin overview page (`/admin`) with counts and activity feed
11. Manual smoke test of the full flow

Each task ends with green tests and a clean `next build`. Same cadence as Plan 1.

## 9. Open items (not blocking)

- Supabase project's email rate limits on the free tier — fine for handful-of-invites scale; revisit if we need bulk invites later.
- Branded sender address (e.g. `pms@dcahub.org`) — deferred to post-Plan-4 with custom domain setup.
- Two-factor enforcement for `admin` global role — listed as open in parent spec; remains open.

## 10. Success criteria

Plan 2 is done when:

1. All migrations applied; types regenerated; build clean.
2. All unit + integration tests pass.
3. Admin can complete the full manual smoke test (§7) end-to-end without touching SQL or Supabase Studio.
4. Non-admin users cannot reach `/admin/*` (verified by middleware redirect + layout guard).
5. The admin console can fully prepare the SOCO project shell so Plan 3 can begin populating phases and activities.
