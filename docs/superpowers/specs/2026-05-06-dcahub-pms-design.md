# DC&A Hub PMS — Design Spec

**Date:** 2026-05-06
**Status:** Approved (pending user review of written spec)
**Authors:** Ishmael + Claude

## 1. Goal

Build a project management system, **DC&A Hub PMS**, that lets DC&A Hub staff track project work (phases, activities, proofs) and lets each client log in to see live progress on their own project — with proof of every completed activity.

First project to run through it: **SOCO**. Other projects DC&A Hub runs (DARE, Ghana Grows, etc.) onboard later.

## 2. Origin & stack

- New repo `dcahub-pms`, created by **copying `springboard-mis`** (Next.js 16 + Supabase + shadcn/ui + Tailwind v4 + echarts + lucide). Git history starts fresh; not a fork.
- New, separate **Supabase project** (no shared DB with springboard-mis).
- New, separate **Vercel project**. Default domain `dcahub-pms.vercel.app` for v1; custom domain (e.g. `pms.dcahub.org`) deferred.
- Branding: name **"DC&A Hub PMS"**. Neutral defaults; logo + brand colours swapped in later.

## 3. Three logical surfaces, one app

The Next.js app exposes three role-gated surfaces:

1. **Admin console** (`/admin/*`) — manage clients, projects, users, roles.
2. **Internal workspace** (`/workspace/*`) — PM/MEL staff build workplans and complete activities.
3. **Client portal** (`/portal/*`) — read-only progress view for clients.

Middleware reads `profiles.role` and bounces a user to their own surface if they hit a route outside their role.

## 4. Roles

Stored on `profiles.role`:

| Role | Purpose | Access |
|---|---|---|
| `admin` | DC&A Hub leadership | Everything (RLS bypass) |
| `staff` | DC&A Hub project staff (PM, MEL, etc.) | Projects they're assigned to (workspace) |
| `client` | Client viewer | Projects assigned to them, read-only (portal) |

PM and MEL are not separate roles in v1 — both fall under `staff`. If we later need to differentiate (e.g. only MEL can edit proofs), we add a per-project sub-role then.

**Note on naming:** the *global* role on `profiles.role` is one of `admin|staff|client`. The *per-project* role on `project_members.project_role` is one of `member|viewer`. A user with global `staff` is added to a project as `member`; a global `client` is added as `viewer`. Different vocabularies because they answer different questions ("what kind of user are you?" vs "what is your role on this specific project?").

## 5. Data model

All tables get `id uuid pk default gen_random_uuid()`, `created_at timestamptz`, `updated_at timestamptz`.

### Tables

**`profiles`** — one row per `auth.users` user
- `user_id uuid` (FK → `auth.users`, unique)
- `full_name text`, `email text`, `role text check (role in ('admin','staff','client'))`
- `avatar_url text`

**`clients`** — organisations DC&A Hub serves
- `name text`, `contact_email text`, `logo_url text`

**`projects`**
- `name text`, `code text` (e.g. "SOCO")
- `client_id uuid` (FK → `clients`)
- `start_date date`, `end_date date`
- `status text check (status in ('planning','active','paused','completed'))`
- `description text`, `cover_image_url text`

**`project_members`** — access grants
- `project_id uuid` (FK → `projects`)
- `user_id uuid` (FK → `auth.users`)
- `project_role text check (project_role in ('member','viewer'))`
- Unique on `(project_id, user_id)`

**`phases`**
- `project_id uuid` (FK)
- `name text`, `order_index int`
- `start_date date`, `end_date date`, `description text`

**`activities`**
- `phase_id uuid` (FK)
- `name text`, `description text`
- `planned_date date`, `completed_date date null`
- `status text check (status in ('not_started','in_progress','done')) default 'not_started'`
- `location text`, `participants_count int null`, `narrative_note text`
- `order_index int`
- `created_by uuid` (FK → `auth.users`)

**`activity_proofs`**
- `activity_id uuid` (FK)
- `file_path text` (Supabase Storage key), `file_name text`
- `mime_type text`, `size_bytes bigint`
- `caption text`, `uploaded_by uuid` (FK → `auth.users`)

**`activity_log`** — audit trail
- `project_id uuid` (FK), `activity_id uuid null` (FK)
- `actor_user_id uuid` (FK → `auth.users`)
- `action text check (action in ('created','updated','marked_done','proof_added','proof_deleted'))`
- `meta jsonb`

### Storage

- Bucket `proofs` (private).
- Key format: `projects/{project_id}/activities/{activity_id}/{uuid}-{filename}`.
- Files served via signed URLs only (1-hour TTL).

### RLS

- `admin` → bypass (policy `auth.jwt() ->> 'role' = 'admin'` on all tables, or a dedicated `is_admin()` SQL function).
- `staff` → read/write rows where a `project_members` row exists for `(project_id, auth.uid())` with `project_role = 'member'`. Includes children (`phases`, `activities`, `activity_proofs`) joined back to `project_id` via `phase → project` lookup.
- `client` → read-only on `projects`, `phases`, `activities`, `activity_proofs` where `project_members.project_role = 'viewer'` and `user_id = auth.uid()`. **No** access to `activity_log` or `clients` (other than their own client row, which they don't need to query directly).
- Storage `proofs` bucket: a Postgres helper `can_access_project(project_id, auth.uid())` is called in the bucket policy before signing URLs. Same membership check.

The intent: a bug in app code cannot leak Client A's proofs to Client B because the database itself refuses the read.

## 6. Routes

### Public
- `/login`, `/forgot-password`, `/reset-password`

### Admin (`role = admin`)
- `/admin` — overview (all projects, recent org-wide activity)
- `/admin/clients`, `/admin/clients/[id]`
- `/admin/projects`, `/admin/projects/[id]` (edit meta, assign members)
- `/admin/users` — list users, invite, set role

### Workspace (`role in (staff, admin)`)
- `/workspace` — "my projects"
- `/workspace/projects/[id]` — phase board
- `/workspace/projects/[id]/phases/[phaseId]`
- `/workspace/projects/[id]/activities/new`
- `/workspace/projects/[id]/activities/[activityId]` — edit, mark done, upload proofs
- `/workspace/projects/[id]/team` — staff member can see who's on the project; only admin can change membership

### Portal (`role = client`)
- `/portal` — list of their projects (or auto-redirect if just one)
- `/portal/projects/[id]` — **C-lite view**: % complete strip, phase board, recent-activity feed
- `/portal/projects/[id]/activities/[activityId]` — read-only detail + signed-URL proof downloads

### Shared
- `/account` — profile + password change

## 7. Key flows

### 7.1 Admin onboards a new project
1. Admin creates/picks a client (`/admin/clients`).
2. Admin creates project shell at `/admin/projects` (name, code, dates, status=`planning`).
3. Admin assigns staff (PM, MEL, etc.) as project `member`s and invites the client viewer by email (Supabase invite).
4. Invitees set their password and land on their role's home.

### 7.2 PM builds the workplan
1. PM opens the project at `/workspace/projects/[id]`.
2. Empty state → "Add your first phase". Adds phases (Inception, Field Work, Reporting, etc.) with `order_index` and dates.
3. Adds activities under each phase (name, planned_date, location).
4. Drag-to-reorder phases/activities (writes `order_index`).

### 7.3 PM/MEL completes an activity (proof flow)
1. Open activity → fill `completed_date`, `participants_count`, `narrative_note`.
2. Upload proof files (drag-drop, multi-file, optional caption per file). Stored in `proofs` bucket.
3. Click **Mark as done** → status → `done`, `activity_log` row written, **email notification fires to all `viewer` members of the project**.
4. Activity now appears in the client portal's recent-activity feed.

### 7.4 Client views progress
1. Client logs in → lands on their project.
2. C-lite view:
   - Top strip: % complete (`done activities / total activities`), last completed activity date, next planned milestone, project start/end dates.
   - Phase board: phases as sections, activities grouped by status.
   - Recent activity feed: last 10 activities marked `done`, newest first, with a thumbnail of the first image proof if present.
3. Click any `done` activity → read-only detail page with narrative + proof downloads (signed URLs, 1-hour TTL).

### 7.5 Admin oversight
1. `/admin` shows all active projects, recent org-wide activity, member counts.
2. Admin can open any project (RLS bypass) and act as if a member.

## 8. Email notifications (v1)

- Trigger: `activities.status` transitions to `done`.
- Implementation: Supabase Edge Function invoked from a Postgres trigger (`AFTER UPDATE ON activities`), or invoked directly from the server action that flips the status. Latter is preferred (easier to test, easier to retry).
- Recipients: all users in `project_members` with `project_role = 'viewer'` for that project.
- Email provider: **Resend** (small free tier, simple API). Configurable via env var; provider can be swapped later.
- Subject: `[Project Name] New activity completed: [Activity Name]`
- Body: short summary (project, activity name, completed date, narrative excerpt), link to `/portal/projects/[id]/activities/[activityId]`. Plain HTML, no images embedded.
- Failure handling: log to `activity_log.meta` if the email send fails; do not block the status change. No retry queue in v1.

## 9. Out of scope for v1

- Comments / approvals from clients
- Activity-type templates with per-type required fields/proofs (deferred — was option C in Q4)
- Spreadsheet import of workplans (deferred — was option C in Q6)
- Charts beyond the % complete strip
- In-app notifications (email only in v1)
- Mobile app — responsive web only
- Multi-org tenancy (each DC&A Hub is the only tenant; clients are not orgs, just users with `viewer` role on a project)
- Replacing the SRSF-specific code in the copied repo in one pass — only what's necessary to build the surfaces above. Unrelated SRSF features can be removed lazily as they get in the way.

## 10. Migration & seed plan

- Initial Supabase migration creates all tables, indexes, RLS policies, the `proofs` bucket, the `can_access_project()` helper, and triggers/policies.
- Seed script (idempotent) creates:
  - One `admin` user (Ishmael's email) — invited via Supabase, no password in code.
  - The `SOCO` project shell with its client, ready for the PM to populate.
- No data migration from springboard-mis (different domain, fresh start).

## 11. Open items (not blocking spec, decide before launch)

- Final brand colours + logo for DC&A Hub.
- Custom domain (e.g. `pms.dcahub.org`) and DNS setup.
- Resend API key (or alternative provider) for email.
- Whether to enforce 2FA for `admin` role at launch (Supabase supports TOTP).

## 12. Success criteria

v1 ships when:
1. Admin can create the SOCO project, assign a PM/MEL, and invite the client.
2. PM can build the SOCO workplan (phases + activities) in the UI.
3. MEL can mark an activity done with proofs, and the assigned client receives an email.
4. The client logs in and sees the C-lite view with that activity in the feed and downloadable proofs.
5. Client A cannot read Client B's project — verified by an RLS test, not just a UI check.
