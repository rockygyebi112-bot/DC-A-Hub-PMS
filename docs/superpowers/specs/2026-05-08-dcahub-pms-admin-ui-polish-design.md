# DC&A Hub PMS — Plan 2.5: Admin UI Polish Design Spec

**Date:** 2026-05-08
**Status:** Approved (pending user review of written spec)
**Authors:** Ishmael + Claude
**Parent specs:**
- [`2026-05-06-dcahub-pms-design.md`](./2026-05-06-dcahub-pms-design.md)
- [`2026-05-07-dcahub-pms-admin-console-design.md`](./2026-05-07-dcahub-pms-admin-console-design.md)

## 1. Goal

Lift the admin console from "functional" to "professional and pleasant to use" without adding features. Visual and UX refinement only. Every flow built in Plan 2 keeps working unchanged.

## 2. Out of scope

- New routes, fields, server actions, or migrations
- Workspace (`/workspace/*`) and portal (`/portal/*`) — those get polished alongside Plans 3 and 4
- Mobile (< 640px) — tablet (640-1024px) is in scope; phone deferred
- Custom fonts, custom illustrations, brand asset replacement (logo file already in `public/logo.png`)
- Internationalisation, accessibility audit beyond focus rings and aria-labels we already had

## 3. Locked decisions

| # | Question | Decision |
|---|---|---|
| 1 | Scope ambition | Major redesign (~12 tasks): full sidebar treatment, redesigned dashboard, sectioned forms, theme toggle, motion accents, tablet responsive |
| 2 | Visual direction | Calm, professional (Linear/Vercel-style): soft neutrals, generous whitespace, brand green as restrained accent, subtle borders and shadows |
| 3 | Brand color | Existing green `hsl(104 53% 49%)` already in `globals.css`; keep |
| 4 | Density | Tables use a 44px row height; cards use a 12px corner radius |
| 5 | New deps | None — `next-themes`, `lucide-react`, `dropdown-menu` already available |

## 4. Design tokens

Three additions to the `:root` block in `src/app/globals.css`, plus matching values in the dark-mode block:

```css
--admin-row-h: 44px;
--admin-card-radius: 12px;

--status-planning: var(--muted);
--status-active:   hsl(104 53% 49%);
--status-paused:   hsl(38 92% 50%);
--status-completed: hsl(220 13% 60%);
```

Dark-mode variants of the status colors lift saturation slightly so the pills stay legible on the dark surface.

## 5. New primitives

All new components live under `src/components/admin/ui/` and are pure (props in, JSX out — no data fetching, no server actions). Each has one clear responsibility.

| File | Purpose | Key props |
|---|---|---|
| `page-header.tsx` | Standard page top: title + optional subtitle + optional right-side action | `title`, `subtitle?`, `action?` (ReactNode) |
| `section-card.tsx` | Wraps form sections with a label and optional description | `title`, `description?`, `children`, `tone?: "default" \| "destructive"` |
| `stat-card.tsx` | Overview dashboard card: label, big number, optional delta line, optional href for "view all" | `label`, `value`, `href?`, `delta?: { value: number; period: string }` |
| `status-pill.tsx` | Project/user status indicator | `status: "planning" \| "active" \| "paused" \| "completed" \| "archived" \| "active-user" \| "inactive-user"` |
| `user-avatar.tsx` | Initials avatar with deterministic color from email hash | `email`, `name`, `size?: "sm" \| "md" \| "lg"` |
| `admin-topbar.tsx` | Replaces the thin header inside `admin-shell.tsx`. Contains breadcrumbs (left) + theme toggle + user dropdown (right) | `userLabel`, `email` |
| `breadcrumbs.tsx` | Computes breadcrumbs from `usePathname()` against a route map | `routeMap` (path → label) |
| `user-dropdown.tsx` | Topbar-right menu with the user's name, "Account", and "Sign out" | `name`, `email` |

The existing `src/components/empty-state.tsx` is extended (not replaced) with optional `icon: LucideIcon` and `action: ReactNode` props so list pages can use a consistent empty pattern.

## 6. AdminShell rewrite

`src/components/admin/admin-shell.tsx` becomes the layout wrapper. It composes:

```
<div className="flex min-h-screen">
  <AdminSidebar collapsed={...} counts={...} />
  <div className="flex-1 flex flex-col">
    <AdminTopbar userLabel={...} email={...} />
    <main className="flex-1 p-6 md:p-8">{children}</main>
  </div>
</div>
```

**Sidebar** (`admin-sidebar.tsx`) is rewritten to support:

- **Collapse toggle** — chevron at the bottom of the sidebar; persisted to `localStorage` under key `admin.sidebar.collapsed`
- **Two grouped sections**: "Workspace" (Overview only for v1) and "Manage" (Clients, Projects, Users)
- **Count badges** on Manage items — integer counts of active rows, fetched server-side in `app/admin/layout.tsx` and passed as props
- **Active-state styling** matches what's there today, plus a left-border accent in brand green
- **Icon-only mode** when collapsed (60px wide instead of 240px)
- **Tablet breakpoint**: at < 1024px the sidebar starts collapsed by default, expand-on-hover (using a CSS-only transition)

**Topbar** (`admin-topbar.tsx`) is a new component that:

- Renders breadcrumbs derived from the current path (e.g. `Projects → SOCO Test → Team`)
- Has a theme toggle (sun/moon icon, calls `next-themes`'s `setTheme`)
- Has a user dropdown showing user name, email, an "Account" link (placeholder, links to `/account` which will exist in a later plan), and a "Sign out" form button that calls the existing logout action

## 7. Page-by-page refresh

Every page under `src/app/admin/**` gets the same skeleton:

```tsx
<>
  <PageHeader title="..." subtitle="..." action={<Button>...</Button>} />
  {/* filter row when applicable */}
  {/* main content: table, form, or grid */}
</>
```

### 7.1 `/admin` (Overview)

- **Hero strip**: "Welcome back, {firstName}." + dynamic one-line summary derived from current counts ("3 active projects across 2 clients")
- **4-card stats row**: Active projects, Active users, Clients, Pending invites (count of profiles created in last 7 days)
- **Two-column body**:
  - Left (2/3 width): "Recent activity" card with the existing feed, polished — `<UserAvatar>` + action verb + project chip + relative timestamp
  - Right (1/3 width): "Quick actions" card with three full-width buttons (New client / New project / Invite user) and below it a "Recently created" mini-list of the 5 newest projects

### 7.2 `/admin/clients`

- `<PageHeader title="Clients" subtitle="Organisations DC&A Hub serves" action={<Button>New client</Button>}>`
- Filter row: client-side search input (filters by name/email) + `<ArchiveToggle>` + count badge "{n} clients"
- Table columns: Name (with logo if `logo_url` is set, otherwise initials), Contact email, Project count (computed via a lightweight aggregate query), Status pill, row-end DropdownMenu (Open / Archive)
- Empty state: `Building2` icon + "No clients yet" + "Create your first client" primary CTA

### 7.3 `/admin/projects`

- Same header pattern; subtitle "All projects across clients"
- Filter row: search + status filter chips (Planning / Active / Paused / Completed / Archived) + `<ArchiveToggle>`
- Table columns: Name + code (mono), Client name, StatusPill, Start–End dates, row dropdown
- Empty state: `FolderKanban` icon

### 7.4 `/admin/projects/[id]`

- Breadcrumbs: Projects → {project name}
- `<PageHeader>` shows project name + code chip + status pill on the left; "Manage team →" link on the right
- Form split into three `<SectionCard>`s:
  - **Basics** — Name, Code, Client, Status
  - **Schedule** — Start date, End date
  - **Description** — Description textarea
- **Sticky bottom bar** with Save + Cancel buttons, only visible while the form is dirty
- **Danger zone** — its own `<SectionCard tone="destructive">` at the bottom with the existing archive/restore button

### 7.5 `/admin/projects/[id]/team`

- Breadcrumbs: Projects → {name} → Team
- A single `<SectionCard title="Team">` containing:
  - Avatar list at the top (overlapping circles, max 8 visible, "+N more" overflow)
  - Members table below
- The three "Add" actions are consolidated into one dropdown button at the top-right of the SectionCard: **Add to team ▾** with options Add staff / Add existing client viewer / Invite new client viewer
- Role pills: `member` green-tinted, `viewer` slate-tinted

### 7.6 `/admin/projects/new`

- Same three-section form layout as `[id]`, no Danger zone

### 7.7 `/admin/users`

- `<PageHeader>` + filter row: search + role filter chips (Admin / Staff / Client) + show-inactive toggle
- Table columns: `<UserAvatar>` + name, Email, Role pill (StatusPill variant), Status pill, row dropdown (Open / Deactivate or Reactivate)
- Empty state: `Users` icon

### 7.8 `/admin/users/[id]`

- Breadcrumbs: Users → {name}
- Header has `<UserAvatar size="lg">` + name + email + status pill
- Two `<SectionCard>`s: Role (with the existing select + save), Danger zone

### 7.9 `/admin/clients/new` and `/admin/clients/[id]`

- Single `<SectionCard title="Basics">` containing the existing fields
- Edit page also shows a `<SectionCard tone="destructive">` for archive/restore

## 8. Light/dark theme

- `next-themes` is already in `package.json`. Wire `<ThemeProvider attribute="class">` in `src/app/layout.tsx` (root layout)
- Theme toggle lives in the admin topbar (sun/moon icon button)
- Persistence: `next-themes` handles localStorage automatically
- Dark variants: existing dark CSS in `globals.css` covers most surfaces; this plan tunes the new `--admin-*` and `--status-*` tokens for dark and verifies every admin page looks right in both modes
- System default is preferred but user choice overrides

## 9. Motion

- Toast animations: rely on `sonner`'s built-in motion (already a dep)
- Dialog open/close: rely on base-ui's `data-open` / `data-closed` transitions already wired into `dialog.tsx`
- Page entry: a small CSS fade on `main` (50ms) when the path changes, via a `key={pathname}` trick on the `<main>` wrapper
- Focus rings: tighten `:focus-visible` using existing `--ring` token; no new motion code

## 10. Tablet responsive

- Layout breakpoint: 1024px (`lg`)
- Below `lg`: sidebar starts collapsed (icon-only), expands on hover
- Below `md` (768px): the dashboard's two-column grid stacks vertically; tables get horizontal scroll instead of breaking layout
- Forms remain single-column always; section cards stack naturally

## 11. Implementation order

Bottom-up, lowest-risk-first:

1. Add tokens to `globals.css` and wire `next-themes` in root layout
2. Build the new primitives in `src/components/admin/ui/` (no consumers yet — pure components)
3. Replace the topbar inside `admin-shell.tsx` with the new `<AdminTopbar>`
4. Rewrite `admin-sidebar.tsx` (collapsible, grouped, count badges)
5. Refactor `/admin` overview page
6. Refactor `/admin/clients` list, then new, then `[id]`
7. Refactor `/admin/projects` list, new, `[id]`
8. Refactor `/admin/projects/[id]/team`
9. Refactor `/admin/users` list, then `[id]`
10. Empty-states pass — verify every list uses the extended `<EmptyState>` consistently
11. Forms pass — verify every edit/new page uses sectioned cards and the sticky save bar
12. Quality pass — `npm run build` clean, then walk every admin page in light and dark mode and fix anything visually broken

Each step ends with a green build and a commit.

## 12. Testing strategy

No new automated tests. The 44 existing tests already cover schemas, server actions, and RLS — none of those change in 2.5. Visual changes are verified manually:

- After step 12 (quality pass), walk every admin page in both themes
- Confirm the Plan 2 manual smoke flow (Task 14 of Plan 2) still works end-to-end with the new UI
- `npm run build` passes after every commit

If a refactor accidentally breaks a server action wiring, the existing integration tests catch it.

## 13. Success criteria

Plan 2.5 is done when:

1. All 12 tasks committed; `npm run build` clean.
2. All 44 existing tests still pass.
3. Light and dark modes both render every admin page without visual regressions.
4. The Plan 2 smoke flow (admin invites staff, creates client + project, assigns members, invites client viewer, role-gating works on login) still passes end-to-end.
5. The admin console feels like a finished product on first impression — when you open `/admin`, it reads as deliberate and polished, not template-y.
