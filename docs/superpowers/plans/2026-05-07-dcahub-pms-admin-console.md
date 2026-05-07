# DC&A Hub PMS — Plan 2: Admin Console

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working admin console at `/admin/*` that lets the admin create/archive client organisations, create/archive project shells, assign staff to projects as `member`s, invite client viewers by email, manage users (invite/role/deactivate), and see an org-wide overview.

**Architecture:** Add a new migration that introduces archive columns and an `is_active` user flag, extend the existing RLS policies to hide archived rows from non-admins, build a shared `AdminShell` layout with a persistent sidebar, then implement four CRUD areas (clients, projects, users, project-members) using server actions backed by zod schemas shared between forms and actions. User invitations go through Supabase's `auth.admin.inviteUserByEmail` + a profile insert.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + Auth + RLS), TypeScript, shadcn/ui (base-nova / neutral), Tailwind v4, react-hook-form + zod + @hookform/resolvers, Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-07-dcahub-pms-admin-console-design.md`](../specs/2026-05-07-dcahub-pms-admin-console-design.md)

**Parent spec:** [`docs/superpowers/specs/2026-05-06-dcahub-pms-design.md`](../specs/2026-05-06-dcahub-pms-design.md)

---

## File Structure (after this plan)

```
dcahub-pms/
  src/
    app/
      admin/
        layout.tsx                       # NEW — AdminShell wrapper + admin guard
        page.tsx                         # MOD — overview cards + recent activity feed
        clients/
          page.tsx                       # NEW — list
          new/page.tsx                   # NEW — create form
          [id]/page.tsx                  # NEW — edit + archive
        projects/
          page.tsx                       # NEW — list
          new/page.tsx                   # NEW — create form
          [id]/
            page.tsx                     # NEW — edit meta + archive
            team/page.tsx                # NEW — members + invite client viewer
        users/
          page.tsx                       # NEW — list + invite
          [id]/page.tsx                  # NEW — edit role / deactivate
    components/
      admin/
        admin-shell.tsx                  # NEW
        admin-sidebar.tsx                # NEW (split for clarity)
        archive-toggle.tsx               # NEW
        forms/
          client-form.tsx                # NEW
          project-form.tsx                # NEW
          invite-user-form.tsx           # NEW
          assign-member-form.tsx         # NEW
          invite-client-viewer-form.tsx  # NEW
      ui/
        form.tsx                         # NEW (shadcn add)
        sidebar.tsx                      # NEW (shadcn add)
        sheet.tsx                        # NEW (shadcn add)
        command.tsx                      # NEW (shadcn add)
        popover.tsx                      # NEW (shadcn add)
        separator.tsx                    # NEW (shadcn add)
        breadcrumb.tsx                   # NEW (shadcn add)
    lib/
      admin/
        actions/
          clients.ts                     # NEW
          projects.ts                    # NEW
          members.ts                     # NEW
          users.ts                       # NEW
        schemas.ts                       # NEW — zod schemas
        queries.ts                       # NEW — typed read helpers
      supabase/
        types.ts                         # MOD — regenerated after migration
  supabase/
    migrations/
      0005_archive_and_active.sql        # NEW
      0006_archive_rls.sql               # NEW
  tests/
    admin/
      schemas.test.ts                    # NEW — unit tests
    integration/
      admin-actions.test.ts              # NEW — happy-path action tests
      admin-rls.test.ts                  # NEW — archive RLS tests
```

---

## Task 1: Add archive columns and is_active flag

**Files:**
- Create: `supabase/migrations/0005_archive_and_active.sql`
- Modify: `src/lib/supabase/types.ts` (regenerated)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0005_archive_and_active.sql`:

```sql
-- DC&A Hub PMS — archive columns + user is_active flag

alter table clients  add column archived_at timestamptz;
alter table projects add column archived_at timestamptz;
alter table profiles add column is_active boolean not null default true;

create index clients_active_idx  on clients  (archived_at) where archived_at is null;
create index projects_active_idx on projects (archived_at) where archived_at is null;
create index profiles_active_idx on profiles (is_active) where is_active = true;
```

- [ ] **Step 2: Apply the migration**

```powershell
npx supabase db push
```

Expected: `0005_archive_and_active.sql` applied, no errors.

- [ ] **Step 3: Regenerate TypeScript types**

```powershell
npm run db:types
```

Expected: `src/lib/supabase/types.ts` rewritten. New columns visible by grepping:

```powershell
Select-String -Path src\lib\supabase\types.ts -Pattern "archived_at|is_active"
```

Expected: at least 6 matches (3 cols × Row + Insert/Update generic blocks).

- [ ] **Step 4: Verify build still passes**

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations/0005_archive_and_active.sql src/lib/supabase/types.ts
git commit -m "feat(db): add archived_at on clients/projects and is_active on profiles"
```

---

## Task 2: Hide archived rows from non-admin reads

The existing SELECT policies on `clients` and `projects` use `can_access_project(...)` which permits both `member` and `viewer` reads. We extend the policies so non-admins only see rows with `archived_at is null`. Admins still see everything.

**Files:**
- Create: `supabase/migrations/0006_archive_rls.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0006_archive_rls.sql`:

```sql
-- DC&A Hub PMS — extend non-admin SELECT policies to hide archived rows

-- projects: replace projects_member_read so non-admin only sees non-archived
drop policy if exists projects_member_read on projects;
create policy projects_member_read on projects for select
  using (
    public.is_admin()
    or (archived_at is null and public.can_access_project(id))
  );

-- clients: replace clients_member_read with archive-aware variant
drop policy if exists clients_member_read on clients;
create policy clients_member_read on clients for select
  using (
    public.is_admin()
    or (
      archived_at is null
      and exists (
        select 1 from projects p
        join project_members pm on pm.project_id = p.id
        where p.client_id = clients.id
          and pm.user_id = auth.uid()
          and p.archived_at is null
      )
    )
  );
```

- [ ] **Step 2: Apply the migration**

```powershell
npx supabase db push
```

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/0006_archive_rls.sql
git commit -m "feat(db): hide archived rows from non-admin reads"
```

---

## Task 3: Install Plan 2 dependencies and shadcn components

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/components/ui/form.tsx`, `sidebar.tsx`, `sheet.tsx`, `command.tsx`, `popover.tsx`, `separator.tsx`, `breadcrumb.tsx` (via shadcn CLI)

- [ ] **Step 1: Install form libraries**

```powershell
npm install react-hook-form zod @hookform/resolvers
```

Expected: three new dependencies in `package.json`.

- [ ] **Step 2: Add the shadcn primitives we need**

```powershell
npx shadcn@latest add form sidebar sheet command popover separator breadcrumb
```

If the CLI prompts to overwrite anything, decline (we don't want it to clobber existing components). Expected: 7 new files in `src/components/ui/`.

- [ ] **Step 3: Verify build**

```powershell
npm run build
```

Expected: build succeeds. (Some shadcn primitives may pull in `class-variance-authority`/`@radix-ui/*` peer deps — confirm `npm install` completed cleanly. If `next build` errors with a missing module, install it explicitly.)

- [ ] **Step 4: Commit**

```powershell
git add package.json package-lock.json src/components/ui
git commit -m "chore: add RHF + zod and shadcn primitives for admin console"
```

---

## Task 4: Admin shell layout with sidebar and admin guard

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/components/admin/admin-shell.tsx`
- Create: `src/components/admin/admin-sidebar.tsx`

The layout wraps every `/admin/*` route, calls `getCurrentProfile()`, and renders a 403-style page if the user is not an admin (defence in depth — `src/proxy.ts` already redirects, this catches any direct render path).

- [ ] **Step 1: Create the sidebar component**

Create `src/components/admin/admin-sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, FolderKanban, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/clients", label: "Clients", icon: Building2 },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/users", label: "Users", icon: Users },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r bg-muted/40 px-3 py-6">
      <div className="px-2 mb-6">
        <p className="text-sm font-semibold">DC&amp;A Hub PMS</p>
        <p className="text-xs text-muted-foreground">Admin Console</p>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                active
                  ? "bg-background font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create the shell wrapper**

Create `src/components/admin/admin-shell.tsx`:

```tsx
import type { ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";

export function AdminShell({
  children,
  userLabel,
}: {
  children: ReactNode;
  userLabel: string;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b flex items-center justify-end px-6 text-sm text-muted-foreground">
          {userLabel}
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/admin/layout.tsx` with the guard**

```tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const userLabel = `${profile.fullName} · ${profile.email}`;
  return <AdminShell userLabel={userLabel}>{children}</AdminShell>;
}
```

- [ ] **Step 4: Verify the existing `/admin` page still renders inside the shell**

```powershell
npm run dev
```

Open `http://localhost:3000` in a browser, log in as the seeded admin. You should land on `/admin` and see:
- Left sidebar with four items (Overview active)
- Top-right user label
- Existing placeholder content

Cancel with Ctrl+C.

- [ ] **Step 5: Commit**

```powershell
git add src/app/admin/layout.tsx src/components/admin
git commit -m "feat(admin): add AdminShell layout with sidebar and admin guard"
```

---

## Task 5: Zod schemas + unit tests

**Files:**
- Create: `src/lib/admin/schemas.ts`
- Create: `tests/admin/schemas.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/admin/schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  clientFormSchema,
  projectFormSchema,
  inviteUserSchema,
  assignMemberSchema,
  inviteClientViewerSchema,
} from "@/lib/admin/schemas";

describe("clientFormSchema", () => {
  it("accepts valid input", () => {
    expect(
      clientFormSchema.safeParse({ name: "Acme", contact_email: "a@b.com" })
        .success,
    ).toBe(true);
  });
  it("requires name", () => {
    expect(clientFormSchema.safeParse({ name: "" }).success).toBe(false);
  });
  it("rejects bad email", () => {
    expect(
      clientFormSchema.safeParse({ name: "Acme", contact_email: "not-email" })
        .success,
    ).toBe(false);
  });
  it("contact_email is optional", () => {
    expect(clientFormSchema.safeParse({ name: "Acme" }).success).toBe(true);
  });
});

describe("projectFormSchema", () => {
  const base = {
    name: "SOCO",
    code: "SOCO",
    client_id: "00000000-0000-0000-0000-000000000001",
    status: "planning" as const,
  };
  it("accepts valid input", () => {
    expect(projectFormSchema.safeParse(base).success).toBe(true);
  });
  it("requires name and code", () => {
    expect(projectFormSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...base, code: "" }).success).toBe(false);
  });
  it("rejects invalid status", () => {
    expect(
      projectFormSchema.safeParse({ ...base, status: "bogus" }).success,
    ).toBe(false);
  });
  it("rejects non-uuid client_id", () => {
    expect(
      projectFormSchema.safeParse({ ...base, client_id: "nope" }).success,
    ).toBe(false);
  });
});

describe("inviteUserSchema", () => {
  it("accepts staff and client roles", () => {
    expect(
      inviteUserSchema.safeParse({ email: "a@b.com", role: "staff" }).success,
    ).toBe(true);
    expect(
      inviteUserSchema.safeParse({ email: "a@b.com", role: "client" }).success,
    ).toBe(true);
  });
  it("rejects admin role (must be created via seed/CLI)", () => {
    expect(
      inviteUserSchema.safeParse({ email: "a@b.com", role: "admin" }).success,
    ).toBe(false);
  });
  it("rejects bad email", () => {
    expect(
      inviteUserSchema.safeParse({ email: "no", role: "staff" }).success,
    ).toBe(false);
  });
});

describe("assignMemberSchema", () => {
  it("accepts a uuid + member role", () => {
    expect(
      assignMemberSchema.safeParse({
        user_id: "00000000-0000-0000-0000-000000000001",
        project_role: "member",
      }).success,
    ).toBe(true);
  });
  it("accepts viewer role", () => {
    expect(
      assignMemberSchema.safeParse({
        user_id: "00000000-0000-0000-0000-000000000001",
        project_role: "viewer",
      }).success,
    ).toBe(true);
  });
});

describe("inviteClientViewerSchema", () => {
  it("accepts email + optional name", () => {
    expect(
      inviteClientViewerSchema.safeParse({
        email: "client@x.com",
        full_name: "Client X",
      }).success,
    ).toBe(true);
    expect(
      inviteClientViewerSchema.safeParse({ email: "client@x.com" }).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```powershell
npm test -- tests/admin/schemas.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement schemas**

Create `src/lib/admin/schemas.ts`:

```ts
import { z } from "zod";

export const clientFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  contact_email: z
    .string()
    .trim()
    .email("Must be a valid email")
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  logo_url: z
    .string()
    .url()
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});
export type ClientFormInput = z.infer<typeof clientFormSchema>;

export const projectStatusSchema = z.enum([
  "planning",
  "active",
  "paused",
  "completed",
]);

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, _ and - only"),
  client_id: z.string().uuid("Pick a client"),
  status: projectStatusSchema.default("planning"),
  description: z.string().max(2000).optional(),
  start_date: z.string().date().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
  end_date:   z.string().date().optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
});
export type ProjectFormInput = z.infer<typeof projectFormSchema>;

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Must be a valid email"),
  full_name: z.string().trim().max(200).optional(),
  role: z.enum(["staff", "client"]),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const assignMemberSchema = z.object({
  user_id: z.string().uuid(),
  project_role: z.enum(["member", "viewer"]),
});
export type AssignMemberInput = z.infer<typeof assignMemberSchema>;

export const inviteClientViewerSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().max(200).optional(),
});
export type InviteClientViewerInput = z.infer<typeof inviteClientViewerSchema>;

export const setUserRoleSchema = z.object({
  role: z.enum(["admin", "staff", "client"]),
});
export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;
```

- [ ] **Step 4: Run, confirm pass**

```powershell
npm test -- tests/admin/schemas.test.ts
```

Expected: all tests in this file pass (around 16 cases across 5 describes).

- [ ] **Step 5: Commit**

```powershell
git add src/lib/admin/schemas.ts tests/admin
git commit -m "feat(admin): add zod schemas for admin forms"
```

---

## Task 6: Read helpers (queries)

**Files:**
- Create: `src/lib/admin/queries.ts`

These are thin, typed wrappers used by admin pages. No tests for these directly — they're exercised by the integration tests in later tasks.

- [ ] **Step 1: Implement the query helpers**

Create `src/lib/admin/queries.ts`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listClients(opts: { includeArchived?: boolean } = {}) {
  const sb = await createClient();
  const q = sb
    .from("clients")
    .select("id, name, contact_email, archived_at, created_at")
    .order("name", { ascending: true });
  if (!opts.includeArchived) q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getClient(id: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("clients")
    .select("id, name, contact_email, logo_url, archived_at")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function listProjects(opts: { includeArchived?: boolean } = {}) {
  const sb = await createClient();
  const q = sb
    .from("projects")
    .select(
      "id, name, code, status, archived_at, start_date, end_date, client:clients(id, name)",
    )
    .order("name", { ascending: true });
  if (!opts.includeArchived) q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getProject(id: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("projects")
    .select(
      "id, name, code, status, description, start_date, end_date, archived_at, client_id, client:clients(id, name)",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function listUsers(opts: { includeInactive?: boolean } = {}) {
  const sb = await createClient();
  const q = sb
    .from("profiles")
    .select("id, user_id, full_name, email, role, is_active, created_at")
    .order("full_name", { ascending: true });
  if (!opts.includeInactive) q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getUserByProfileId(id: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("profiles")
    .select("id, user_id, full_name, email, role, is_active")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function listProjectMembers(projectId: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("project_members")
    .select(
      "id, project_role, user_id, profile:profiles!project_members_user_id_fkey(id, full_name, email, role)",
    )
    .eq("project_id", projectId);
  if (error) throw error;
  return data ?? [];
}

export async function listAssignableUsers(
  projectId: string,
  forRole: "staff" | "client",
) {
  const sb = await createClient();
  const targetRole = forRole === "staff" ? ["staff", "admin"] : ["client"];

  const { data: existing } = await sb
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  const taken = new Set((existing ?? []).map((r) => r.user_id));

  const { data, error } = await sb
    .from("profiles")
    .select("id, user_id, full_name, email, role")
    .in("role", targetRole)
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []).filter((p) => !taken.has(p.user_id));
}
```

If `project_members_user_id_fkey` is not the auto-named FK in your schema, the embed will fail at runtime. Resolve by checking `0001_init_schema.sql`'s `project_members.user_id` constraint name (Postgres default is `<table>_<col>_fkey`). If it differs, replace the embed with two queries (one for `project_members`, one for `profiles in (user_ids)`) — see fallback note in Task 12.

- [ ] **Step 2: Verify build**

```powershell
npm run build
```

Expected: build succeeds (no usages yet — this just type-checks).

- [ ] **Step 3: Commit**

```powershell
git add src/lib/admin/queries.ts
git commit -m "feat(admin): add typed read helpers for clients/projects/users/members"
```

---

## Task 7: Clients CRUD — actions, list, create, edit, archive

**Files:**
- Create: `src/lib/admin/actions/clients.ts`
- Create: `src/components/admin/forms/client-form.tsx`
- Create: `src/components/admin/archive-toggle.tsx`
- Create: `src/app/admin/clients/page.tsx`
- Create: `src/app/admin/clients/new/page.tsx`
- Create: `src/app/admin/clients/[id]/page.tsx`

- [ ] **Step 1: Implement server actions**

Create `src/lib/admin/actions/clients.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clientFormSchema, type ClientFormInput } from "@/lib/admin/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function createClientOrg(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = clientFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const sb = await createClient();
  const { data, error } = await sb
    .from("clients")
    .insert({
      name: parsed.data.name,
      contact_email: parsed.data.contact_email ?? null,
      logo_url: parsed.data.logo_url ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/clients");
  return { ok: true, data: { id: data.id } };
}

export async function updateClientOrg(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = clientFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const sb = await createClient();
  const { error } = await sb
    .from("clients")
    .update({
      name: parsed.data.name,
      contact_email: parsed.data.contact_email ?? null,
      logo_url: parsed.data.logo_url ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${id}`);
  return { ok: true };
}

export async function archiveClient(id: string): Promise<ActionResult> {
  const sb = await createClient();
  const { error } = await sb
    .from("clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/clients");
  return { ok: true };
}

export async function restoreClient(id: string): Promise<ActionResult> {
  const sb = await createClient();
  const { error } = await sb
    .from("clients")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/clients");
  return { ok: true };
}

export async function createClientAndRedirect(
  input: ClientFormInput,
): Promise<ActionResult> {
  const result = await createClientOrg(input);
  if (!result.ok) return result;
  redirect(`/admin/clients/${result.data!.id}`);
}
```

- [ ] **Step 2: Build the form component**

Create `src/components/admin/forms/client-form.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  clientFormSchema,
  type ClientFormInput,
} from "@/lib/admin/schemas";
import {
  createClientOrg,
  updateClientOrg,
} from "@/lib/admin/actions/clients";
import { useRouter } from "next/navigation";

type Props = {
  mode: "create" | "edit";
  initial?: ClientFormInput & { id?: string };
};

export function ClientForm({ mode, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: initial?.name ?? "",
      contact_email: initial?.contact_email ?? "",
      logo_url: initial?.logo_url ?? "",
    },
  });

  function onSubmit(values: ClientFormInput) {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createClientOrg(values)
          : await updateClientOrg(initial!.id!, values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "create" ? "Client created" : "Client updated");
      if (mode === "create" && "data" in result && result.data) {
        router.push(`/admin/clients/${result.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. SOCO Foundation" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contact_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="contact@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="logo_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo URL (optional)</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

- [ ] **Step 3: Build the archive toggle**

Create `src/components/admin/archive-toggle.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function ArchiveToggle({ label = "Show archived" }: { label?: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const showing = params.get("archived") === "1";
  const next = new URLSearchParams(Array.from(params.entries()));
  if (showing) next.delete("archived");
  else next.set("archived", "1");
  const href = `${pathname}?${next.toString()}`;
  return (
    <div className="flex items-center gap-2">
      <Switch id="archive-toggle" checked={showing} asChild>
        <Link href={href} aria-label={label} />
      </Switch>
      <Label htmlFor="archive-toggle">{label}</Label>
    </div>
  );
}
```

- [ ] **Step 4: Build the list page**

Create `src/app/admin/clients/page.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listClients } from "@/lib/admin/queries";
import { ArchiveToggle } from "@/components/admin/archive-toggle";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const sp = await searchParams;
  const includeArchived = sp.archived === "1";
  const rows = await listClients({ includeArchived });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <div className="flex items-center gap-4">
          <ArchiveToggle />
          <Button asChild>
            <Link href="/admin/clients/new">New client</Link>
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                No clients yet.
              </TableCell>
            </TableRow>
          )}
          {rows.map((c) => (
            <TableRow key={c.id} className={c.archived_at ? "opacity-60" : ""}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell>{c.contact_email ?? "—"}</TableCell>
              <TableCell>
                {c.archived_at ? (
                  <Badge variant="secondary">Archived</Badge>
                ) : (
                  <Badge>Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/clients/${c.id}`}>Open</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 5: Build the new-client page**

Create `src/app/admin/clients/new/page.tsx`:

```tsx
import Link from "next/link";
import { ClientForm } from "@/components/admin/forms/client-form";

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/clients" className="text-sm text-muted-foreground hover:underline">
          ← Back to clients
        </Link>
        <h1 className="text-2xl font-semibold mt-2">New client</h1>
      </div>
      <ClientForm mode="create" />
    </div>
  );
}
```

- [ ] **Step 6: Build the edit/archive page**

Create `src/app/admin/clients/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/admin/forms/client-form";
import { getClient } from "@/lib/admin/queries";
import {
  archiveClient,
  restoreClient,
} from "@/lib/admin/actions/clients";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getClient(id);

  async function archive() {
    "use server";
    await archiveClient(id);
  }
  async function restore() {
    "use server";
    await restoreClient(id);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/clients" className="text-sm text-muted-foreground hover:underline">
          ← Back to clients
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{c.name}</h1>
        {c.archived_at && (
          <p className="text-sm text-muted-foreground">Archived on {new Date(c.archived_at).toLocaleDateString()}</p>
        )}
      </div>

      <ClientForm
        mode="edit"
        initial={{
          id: c.id,
          name: c.name,
          contact_email: c.contact_email ?? "",
          logo_url: c.logo_url ?? "",
        }}
      />

      <div className="border-t pt-6">
        <h2 className="text-lg font-medium">Danger zone</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Archived clients are hidden from non-admin users. Their projects keep running unless archived separately.
        </p>
        <form action={c.archived_at ? restore : archive} className="mt-4">
          <Button type="submit" variant={c.archived_at ? "default" : "destructive"}>
            {c.archived_at ? "Restore client" : "Archive client"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Build and smoke test in the browser**

```powershell
npm run build
```

Then `npm run dev`, log in, navigate to `/admin/clients`, click **New client**, create one, edit it, archive it, toggle "Show archived", restore.

- [ ] **Step 8: Commit**

```powershell
git add src/lib/admin/actions/clients.ts src/components/admin/forms/client-form.tsx src/components/admin/archive-toggle.tsx src/app/admin/clients
git commit -m "feat(admin): clients CRUD with archive/restore"
```

---

## Task 8: Projects CRUD — actions, list, create, edit, archive

**Files:**
- Create: `src/lib/admin/actions/projects.ts`
- Create: `src/components/admin/forms/project-form.tsx`
- Create: `src/app/admin/projects/page.tsx`
- Create: `src/app/admin/projects/new/page.tsx`
- Create: `src/app/admin/projects/[id]/page.tsx`

- [ ] **Step 1: Implement server actions**

Create `src/lib/admin/actions/projects.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { projectFormSchema } from "@/lib/admin/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function createProject(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = projectFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
  const { data, error } = await sb
    .from("projects")
    .insert({
      name: parsed.data.name,
      code: parsed.data.code,
      client_id: parsed.data.client_id,
      status: parsed.data.status,
      description: parsed.data.description ?? null,
      start_date: parsed.data.start_date ?? null,
      end_date: parsed.data.end_date ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/projects");
  return { ok: true, data: { id: data.id } };
}

export async function updateProject(
  id: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = projectFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
  const { error } = await sb
    .from("projects")
    .update({
      name: parsed.data.name,
      code: parsed.data.code,
      client_id: parsed.data.client_id,
      status: parsed.data.status,
      description: parsed.data.description ?? null,
      start_date: parsed.data.start_date ?? null,
      end_date: parsed.data.end_date ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
  return { ok: true };
}

export async function archiveProject(id: string): Promise<ActionResult> {
  const sb = await createClient();
  const { error } = await sb
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/projects");
  return { ok: true };
}

export async function restoreProject(id: string): Promise<ActionResult> {
  const sb = await createClient();
  const { error } = await sb
    .from("projects")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/projects");
  return { ok: true };
}
```

- [ ] **Step 2: Build the form**

Create `src/components/admin/forms/project-form.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  projectFormSchema,
  type ProjectFormInput,
} from "@/lib/admin/schemas";
import {
  createProject,
  updateProject,
} from "@/lib/admin/actions/projects";

type Props = {
  mode: "create" | "edit";
  clients: { id: string; name: string }[];
  initial?: ProjectFormInput & { id?: string };
};

export function ProjectForm({ mode, clients, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: initial?.name ?? "",
      code: initial?.code ?? "",
      client_id: initial?.client_id ?? "",
      status: initial?.status ?? "planning",
      description: initial?.description ?? "",
      start_date: initial?.start_date ?? "",
      end_date: initial?.end_date ?? "",
    },
  });

  function onSubmit(values: ProjectFormInput) {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createProject(values)
          : await updateProject(initial!.id!, values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "create" ? "Project created" : "Project updated");
      if (mode === "create" && "data" in result && result.data) {
        router.push(`/admin/projects/${result.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl><Input placeholder="SOCO" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="code" render={({ field }) => (
          <FormItem>
            <FormLabel>Code</FormLabel>
            <FormControl><Input placeholder="SOCO" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="client_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Client</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Pick a client" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="status" render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="start_date" render={({ field }) => (
            <FormItem>
              <FormLabel>Start date</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="end_date" render={({ field }) => (
            <FormItem>
              <FormLabel>End date</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl><Textarea rows={4} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Create" : "Save"}
        </Button>
      </form>
    </Form>
  );
}
```

- [ ] **Step 3: Build the list page**

Create `src/app/admin/projects/page.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listProjects } from "@/lib/admin/queries";
import { ArchiveToggle } from "@/components/admin/archive-toggle";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listProjects({ includeArchived: sp.archived === "1" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <div className="flex items-center gap-4">
          <ArchiveToggle />
          <Button asChild><Link href="/admin/projects/new">New project</Link></Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                No projects yet.
              </TableCell>
            </TableRow>
          )}
          {rows.map((p) => (
            <TableRow key={p.id} className={p.archived_at ? "opacity-60" : ""}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell><code>{p.code}</code></TableCell>
              <TableCell>{p.client?.name ?? "—"}</TableCell>
              <TableCell>
                {p.archived_at ? <Badge variant="secondary">Archived</Badge> : <Badge>{p.status}</Badge>}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/projects/${p.id}`}>Open</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 4: Build the new and edit pages**

Create `src/app/admin/projects/new/page.tsx`:

```tsx
import Link from "next/link";
import { ProjectForm } from "@/components/admin/forms/project-form";
import { listClients } from "@/lib/admin/queries";

export default async function NewProjectPage() {
  const clients = await listClients();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/projects" className="text-sm text-muted-foreground hover:underline">
          ← Back to projects
        </Link>
        <h1 className="text-2xl font-semibold mt-2">New project</h1>
      </div>
      <ProjectForm mode="create" clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}
```

Create `src/app/admin/projects/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/admin/forms/project-form";
import { getProject, listClients } from "@/lib/admin/queries";
import { archiveProject, restoreProject } from "@/lib/admin/actions/projects";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [p, clients] = await Promise.all([getProject(id), listClients({ includeArchived: true })]);

  async function archive() { "use server"; await archiveProject(id); }
  async function restore() { "use server"; await restoreProject(id); }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/projects" className="text-sm text-muted-foreground hover:underline">
          ← Back to projects
        </Link>
        <div className="flex items-baseline gap-3 mt-2">
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <code className="text-muted-foreground">{p.code}</code>
        </div>
        <div className="mt-2">
          <Link href={`/admin/projects/${id}/team`} className="text-sm underline">
            Manage team →
          </Link>
        </div>
      </div>

      <ProjectForm
        mode="edit"
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          id: p.id,
          name: p.name,
          code: p.code,
          client_id: p.client_id,
          status: p.status as "planning" | "active" | "paused" | "completed",
          description: p.description ?? "",
          start_date: p.start_date ?? "",
          end_date: p.end_date ?? "",
        }}
      />

      <div className="border-t pt-6">
        <h2 className="text-lg font-medium">Danger zone</h2>
        <form action={p.archived_at ? restore : archive} className="mt-4">
          <Button type="submit" variant={p.archived_at ? "default" : "destructive"}>
            {p.archived_at ? "Restore project" : "Archive project"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Build and smoke test**

```powershell
npm run build
```

Run the dev server, create a project, edit it, archive/restore.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/admin/actions/projects.ts src/components/admin/forms/project-form.tsx src/app/admin/projects
git commit -m "feat(admin): projects CRUD with archive/restore"
```

---

## Task 9: Users — list, invite, change role, deactivate

**Files:**
- Create: `src/lib/admin/actions/users.ts`
- Create: `src/components/admin/forms/invite-user-form.tsx`
- Create: `src/app/admin/users/page.tsx`
- Create: `src/app/admin/users/[id]/page.tsx`

The invite action uses the existing service-role client (`createAdminClient` in `src/lib/supabase/admin.ts`).

- [ ] **Step 1: Implement server actions**

Create `src/lib/admin/actions/users.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  inviteUserSchema,
  setUserRoleSchema,
} from "@/lib/admin/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function assertCallerIsAdmin(): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  return data?.role === "admin" ? user.id : null;
}

export async function inviteUser(
  raw: unknown,
): Promise<ActionResult<{ user_id: string; profile_id: string }>> {
  const parsed = inviteUserSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const callerId = await assertCallerIsAdmin();
  if (!callerId) return { ok: false, error: "Not authorized" };

  const admin = createAdminClient();
  const { data: invite, error: inviteErr } =
    await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${APP_URL}/reset-password`,
    });

  if (inviteErr) {
    if (!inviteErr.message.toLowerCase().includes("already")) {
      return { ok: false, error: inviteErr.message };
    }
  }

  let userId = invite?.user?.id;
  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers();
    userId = list.users.find((u) => u.email === parsed.data.email)?.id;
    if (!userId) return { ok: false, error: "Invite sent but could not resolve user id" };
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        email: parsed.data.email,
        full_name: parsed.data.full_name ?? parsed.data.email,
        role: parsed.data.role,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();
  if (profileErr) return { ok: false, error: profileErr.message };

  revalidatePath("/admin/users");
  return { ok: true, data: { user_id: userId, profile_id: profile.id } };
}

export async function setUserRole(
  profileId: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = setUserRoleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
  const { error } = await sb
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", profileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${profileId}`);
  return { ok: true };
}

export async function deactivateUser(profileId: string): Promise<ActionResult> {
  const callerId = await assertCallerIsAdmin();
  if (!callerId) return { ok: false, error: "Not authorized" };

  const admin = createAdminClient();
  const { data: profile, error: getErr } = await admin
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .single();
  if (getErr) return { ok: false, error: getErr.message };
  if (profile.user_id === callerId) return { ok: false, error: "You cannot deactivate yourself" };

  const { error: banErr } = await admin.auth.admin.updateUserById(profile.user_id, {
    ban_duration: "876000h",
  });
  if (banErr) return { ok: false, error: banErr.message };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ is_active: false })
    .eq("id", profileId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${profileId}`);
  return { ok: true };
}

export async function reactivateUser(profileId: string): Promise<ActionResult> {
  const callerId = await assertCallerIsAdmin();
  if (!callerId) return { ok: false, error: "Not authorized" };

  const admin = createAdminClient();
  const { data: profile, error: getErr } = await admin
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .single();
  if (getErr) return { ok: false, error: getErr.message };

  const { error: unbanErr } = await admin.auth.admin.updateUserById(profile.user_id, {
    ban_duration: "none",
  });
  if (unbanErr) return { ok: false, error: unbanErr.message };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ is_active: true })
    .eq("id", profileId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${profileId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Build the invite form**

Create `src/components/admin/forms/invite-user-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteUserSchema, type InviteUserInput } from "@/lib/admin/schemas";
import { inviteUser } from "@/lib/admin/actions/users";

export function InviteUserForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { email: "", full_name: "", role: "staff" },
  });

  function onSubmit(values: InviteUserInput) {
    startTransition(async () => {
      const result = await inviteUser(values);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`Invite sent to ${values.email}`);
      setOpen(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Invite user</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>They will receive an email to set their password.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full name (optional)</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel>Global role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Sending..." : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Build the users list page**

Create `src/app/admin/users/page.tsx`:

```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listUsers } from "@/lib/admin/queries";
import { InviteUserForm } from "@/components/admin/forms/invite-user-form";
import { ArchiveToggle } from "@/components/admin/archive-toggle";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const sp = await searchParams;
  const includeInactive = sp.archived === "1";
  const rows = await listUsers({ includeInactive });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <div className="flex items-center gap-4">
          <ArchiveToggle label="Show inactive" />
          <InviteUserForm />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                No users yet.
              </TableCell>
            </TableRow>
          )}
          {rows.map((u) => (
            <TableRow key={u.id} className={!u.is_active ? "opacity-60" : ""}>
              <TableCell className="font-medium">{u.full_name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
              <TableCell>
                {u.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/users/${u.id}`}>Open</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 4: Build the user edit page**

Create `src/app/admin/users/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getUserByProfileId } from "@/lib/admin/queries";
import {
  setUserRole,
  deactivateUser,
  reactivateUser,
} from "@/lib/admin/actions/users";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await getUserByProfileId(id);

  async function changeRole(formData: FormData) {
    "use server";
    const role = formData.get("role")?.toString();
    await setUserRole(id, { role });
  }
  async function deactivate() { "use server"; await deactivateUser(id); }
  async function reactivate() { "use server"; await reactivateUser(id); }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:underline">
          ← Back to users
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{u.full_name}</h1>
        <p className="text-sm text-muted-foreground">{u.email}</p>
        <div className="mt-2">
          {u.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
        </div>
      </div>

      <form action={changeRole} className="space-y-2 max-w-sm">
        <label className="text-sm font-medium">Global role</label>
        <Select name="role" defaultValue={u.role}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="secondary">Save role</Button>
      </form>

      <div className="border-t pt-6">
        <h2 className="text-lg font-medium">Danger zone</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Deactivating revokes the user's sessions and prevents future sign-ins.
        </p>
        <form action={u.is_active ? deactivate : reactivate} className="mt-4">
          <Button type="submit" variant={u.is_active ? "destructive" : "default"}>
            {u.is_active ? "Deactivate user" : "Reactivate user"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Build and smoke test**

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/admin/actions/users.ts src/components/admin/forms/invite-user-form.tsx src/app/admin/users
git commit -m "feat(admin): users list + invite + role/deactivate"
```

---

## Task 10: Project team page — members + invite client viewer

**Files:**
- Create: `src/lib/admin/actions/members.ts`
- Create: `src/components/admin/forms/assign-member-form.tsx`
- Create: `src/components/admin/forms/invite-client-viewer-form.tsx`
- Create: `src/app/admin/projects/[id]/team/page.tsx`

- [ ] **Step 1: Member actions**

Create `src/lib/admin/actions/members.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  assignMemberSchema,
  inviteClientViewerSchema,
} from "@/lib/admin/schemas";
import { inviteUser } from "./users";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function addProjectMember(
  projectId: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = assignMemberSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
  const { error } = await sb.from("project_members").insert({
    project_id: projectId,
    user_id: parsed.data.user_id,
    project_role: parsed.data.project_role,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/projects/${projectId}/team`);
  return { ok: true };
}

export async function removeProjectMember(
  projectId: string,
  memberRowId: string,
): Promise<ActionResult> {
  const sb = await createClient();
  const { error } = await sb
    .from("project_members")
    .delete()
    .eq("id", memberRowId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/projects/${projectId}/team`);
  return { ok: true };
}

export async function inviteClientViewer(
  projectId: string,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = inviteClientViewerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const inviteResult = await inviteUser({
    email: parsed.data.email,
    full_name: parsed.data.full_name,
    role: "client",
  });
  if (!inviteResult.ok) return inviteResult;

  const sb = await createClient();
  const { error } = await sb.from("project_members").upsert(
    {
      project_id: projectId,
      user_id: inviteResult.data!.user_id,
      project_role: "viewer",
    },
    { onConflict: "project_id,user_id" },
  );
  if (error) return { ok: false, error: `Invited but membership failed: ${error.message}` };

  revalidatePath(`/admin/projects/${projectId}/team`);
  return { ok: true };
}
```

- [ ] **Step 2: Assign-member form**

Create `src/components/admin/forms/assign-member-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { addProjectMember } from "@/lib/admin/actions/members";

type Candidate = { user_id: string; full_name: string; email: string };

export function AssignMemberForm({
  projectId,
  candidates,
  projectRole,
  buttonLabel,
}: {
  projectId: string;
  candidates: Candidate[];
  projectRole: "member" | "viewer";
  buttonLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!userId) { toast.error("Pick a user"); return; }
    startTransition(async () => {
      const res = await addProjectMember(projectId, {
        user_id: userId,
        project_role: projectRole,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Added");
      setOpen(false);
      setUserId("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary">{buttonLabel}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{buttonLabel}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>User</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder="Pick a user" /></SelectTrigger>
            <SelectContent>
              {candidates.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No eligible users.</div>
              )}
              {candidates.map((c) => (
                <SelectItem key={c.user_id} value={c.user_id}>
                  {c.full_name} ({c.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !userId}>
            {pending ? "Adding..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Invite-client-viewer form**

Create `src/components/admin/forms/invite-client-viewer-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  inviteClientViewerSchema,
  type InviteClientViewerInput,
} from "@/lib/admin/schemas";
import { inviteClientViewer } from "@/lib/admin/actions/members";

export function InviteClientViewerForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<InviteClientViewerInput>({
    resolver: zodResolver(inviteClientViewerSchema),
    defaultValues: { email: "", full_name: "" },
  });

  function onSubmit(values: InviteClientViewerInput) {
    startTransition(async () => {
      const res = await inviteClientViewer(projectId, values);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Invite sent to ${values.email}`);
      setOpen(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Invite client viewer</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Invite client viewer</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input type="email" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full name (optional)</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Inviting..." : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Team page**

Create `src/app/admin/projects/[id]/team/page.tsx`:

```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getProject,
  listProjectMembers,
  listAssignableUsers,
} from "@/lib/admin/queries";
import { removeProjectMember } from "@/lib/admin/actions/members";
import { AssignMemberForm } from "@/components/admin/forms/assign-member-form";
import { InviteClientViewerForm } from "@/components/admin/forms/invite-client-viewer-form";

export default async function ProjectTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, members, staffCandidates, clientCandidates] = await Promise.all([
    getProject(id),
    listProjectMembers(id),
    listAssignableUsers(id, "staff"),
    listAssignableUsers(id, "client"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/projects/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to project
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{project.name} — Team</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <AssignMemberForm
          projectId={id}
          candidates={staffCandidates.map((c) => ({
            user_id: c.user_id,
            full_name: c.full_name,
            email: c.email,
          }))}
          projectRole="member"
          buttonLabel="Add staff member"
        />
        <AssignMemberForm
          projectId={id}
          candidates={clientCandidates.map((c) => ({
            user_id: c.user_id,
            full_name: c.full_name,
            email: c.email,
          }))}
          projectRole="viewer"
          buttonLabel="Add existing client viewer"
        />
        <InviteClientViewerForm projectId={id} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Global role</TableHead>
            <TableHead>Project role</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                No team members yet.
              </TableCell>
            </TableRow>
          )}
          {members.map((m) => {
            async function remove() { "use server"; await removeProjectMember(id, m.id); }
            return (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.profile?.full_name}</TableCell>
                <TableCell>{m.profile?.email}</TableCell>
                <TableCell><Badge variant="outline">{m.profile?.role}</Badge></TableCell>
                <TableCell><Badge>{m.project_role}</Badge></TableCell>
                <TableCell className="text-right">
                  <form action={remove}>
                    <Button type="submit" variant="ghost" size="sm">Remove</Button>
                  </form>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

If the embed `profile:profiles!project_members_user_id_fkey(...)` in `listProjectMembers` fails at runtime (FK constraint named differently), replace `queries.ts::listProjectMembers` with:

```ts
export async function listProjectMembers(projectId: string) {
  const sb = await createClient();
  const { data: rows, error } = await sb
    .from("project_members")
    .select("id, project_role, user_id")
    .eq("project_id", projectId);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];
  const ids = rows.map((r) => r.user_id);
  const { data: profiles, error: pe } = await sb
    .from("profiles")
    .select("id, user_id, full_name, email, role")
    .in("user_id", ids);
  if (pe) throw pe;
  const byUserId = new Map(profiles!.map((p) => [p.user_id, p]));
  return rows.map((r) => ({
    id: r.id,
    project_role: r.project_role as "member" | "viewer",
    user_id: r.user_id,
    profile: byUserId.get(r.user_id),
  }));
}
```

- [ ] **Step 5: Build and smoke test**

```powershell
npm run build
```

In dev: open a project → **Manage team** → add a staff member, invite a client viewer, remove a member.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/admin/actions/members.ts src/components/admin/forms/assign-member-form.tsx src/components/admin/forms/invite-client-viewer-form.tsx src/app/admin/projects/[id]/team
git commit -m "feat(admin): project team page with member assignment and client invite"
```

---

## Task 11: Admin overview page

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Replace the placeholder with the overview**

Replace `src/app/admin/page.tsx` with:

```tsx
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

async function getStats() {
  const sb = await createClient();
  const [
    { count: activeProjects },
    { count: activeUsers },
    { count: activeClients },
    { data: log },
  ] = await Promise.all([
    sb.from("projects").select("*", { count: "exact", head: true }).is("archived_at", null).neq("status", "completed"),
    sb.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
    sb.from("clients").select("*", { count: "exact", head: true }).is("archived_at", null),
    sb.from("activity_log")
      .select("id, action, created_at, project:projects(name), actor:profiles!activity_log_actor_user_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  return {
    activeProjects: activeProjects ?? 0,
    activeUsers: activeUsers ?? 0,
    activeClients: activeClients ?? 0,
    log: log ?? [],
  };
}

export default async function AdminOverview() {
  const stats = await getStats();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Active projects</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.activeProjects}</div>
            <Link href="/admin/projects" className="text-xs text-muted-foreground hover:underline">View all →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Active users</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.activeUsers}</div>
            <Link href="/admin/users" className="text-xs text-muted-foreground hover:underline">View all →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Clients</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.activeClients}</div>
            <Link href="/admin/clients" className="text-xs text-muted-foreground hover:underline">View all →</Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
        <CardContent>
          {stats.log.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {stats.log.map((row) => (
                <li key={row.id} className="flex items-center gap-3 text-sm">
                  <Badge variant="outline">{row.action}</Badge>
                  <span className="font-medium">{row.project?.name ?? "—"}</span>
                  <span className="text-muted-foreground">by {row.actor?.full_name ?? "system"}</span>
                  <span className="ml-auto text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

If the `activity_log_actor_user_id_fkey` embed fails by name, swap to a two-query approach (mirroring the fallback in Task 10) — fetch the log rows, then fetch the joined profiles via `in("user_id", actorIds)`.

- [ ] **Step 2: Build**

```powershell
npm run build
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/admin/page.tsx
git commit -m "feat(admin): overview with counts and recent activity feed"
```

---

## Task 12: Integration tests — admin actions

**Files:**
- Create: `tests/integration/admin-actions.test.ts`

These tests use the same setup pattern as `tests/rls/rls.test.ts`: hit the live Supabase project with the service role key. Server actions can't be invoked from Vitest because they require a Next request context, so we test the **same DB writes** by calling the underlying logic directly through the admin client with the same shape as the actions.

- [ ] **Step 1: Write the test file**

Create `tests/integration/admin-actions.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { adminClient, createTestUser } from "@/../tests/rls/setup";

describe("admin actions (DB layer)", () => {
  const admin = adminClient();

  beforeAll(async () => {
    await createTestUser("admin", "admin-actions-test@example.com");
  }, 60_000);

  it("create + archive + restore client", async () => {
    const { data: created, error: ce } = await admin
      .from("clients")
      .insert({ name: "Action Test Client" })
      .select("id")
      .single();
    expect(ce).toBeNull();
    const id = created!.id;

    const { error: ae } = await admin
      .from("clients")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    expect(ae).toBeNull();

    const { data: archived } = await admin.from("clients").select("archived_at").eq("id", id).single();
    expect(archived?.archived_at).not.toBeNull();

    const { error: re } = await admin.from("clients").update({ archived_at: null }).eq("id", id);
    expect(re).toBeNull();

    await admin.from("clients").delete().eq("id", id);
  });

  it("create + archive project", async () => {
    const { data: client } = await admin
      .from("clients")
      .insert({ name: "ProjActions Client" })
      .select("id")
      .single();

    const { data: proj, error: pe } = await admin
      .from("projects")
      .insert({
        name: "Action Test Project",
        code: `AT-${Date.now()}`,
        client_id: client!.id,
        status: "planning",
      })
      .select("id")
      .single();
    expect(pe).toBeNull();
    const id = proj!.id;

    const { error: ae } = await admin
      .from("projects")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    expect(ae).toBeNull();

    await admin.from("projects").delete().eq("id", id);
    await admin.from("clients").delete().eq("id", client!.id);
  });

  it("invite user creates auth user + profile", async () => {
    const email = `invite-test-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: "http://localhost:3000/reset-password",
    });
    expect(error).toBeNull();
    const userId = data!.user!.id;

    const { error: pe } = await admin.from("profiles").upsert(
      { user_id: userId, email, full_name: email, role: "staff" },
      { onConflict: "user_id" },
    );
    expect(pe).toBeNull();

    const { data: profile } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("user_id", userId)
      .single();
    expect(profile?.role).toBe("staff");
    expect(profile?.is_active).toBe(true);

    await admin.from("profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  });

  it("project_members add + remove", async () => {
    const { data: client } = await admin.from("clients").insert({ name: "PM-Test" }).select("id").single();
    const { data: proj } = await admin
      .from("projects")
      .insert({ name: "PM-Test", code: `PM-${Date.now()}`, client_id: client!.id })
      .select("id")
      .single();
    const userId = await createTestUser("staff", `pm-test-${Date.now()}@example.com`);

    const { data: row, error: ie } = await admin
      .from("project_members")
      .insert({ project_id: proj!.id, user_id: userId, project_role: "member" })
      .select("id")
      .single();
    expect(ie).toBeNull();

    const { error: de } = await admin.from("project_members").delete().eq("id", row!.id);
    expect(de).toBeNull();

    await admin.from("projects").delete().eq("id", proj!.id);
    await admin.from("clients").delete().eq("id", client!.id);
  });

  it("deactivate user — is_active goes false and ban applied", async () => {
    const email = `deact-${Date.now()}@example.com`;
    const userId = await createTestUser("staff", email);

    const { error: be } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });
    expect(be).toBeNull();

    const { error: ue } = await admin
      .from("profiles")
      .update({ is_active: false })
      .eq("user_id", userId);
    expect(ue).toBeNull();

    const { data: list } = await admin.auth.admin.listUsers();
    const u = list.users.find((x) => x.email === email);
    expect(u?.banned_until).toBeTruthy();

    await admin.from("profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  });
});
```

- [ ] **Step 2: Run**

```powershell
npm test -- tests/integration/admin-actions.test.ts
```

Expected: all 5 tests pass against live Supabase.

- [ ] **Step 3: Commit**

```powershell
git add tests/integration
git commit -m "test: integration tests for admin DB actions"
```

---

## Task 13: Integration tests — archive RLS

**Files:**
- Create: `tests/integration/admin-rls.test.ts`

Verifies non-admins cannot see archived rows.

- [ ] **Step 1: Write the test**

Create `tests/integration/admin-rls.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { adminClient, createTestUser, clientAs } from "@/../tests/rls/setup";

const STAFF = "archive-rls-staff@example.com";
let activeProjectId: string;
let archivedProjectId: string;
let clientId: string;

beforeAll(async () => {
  const admin = adminClient();
  const staffId = await createTestUser("staff", STAFF);

  const { data: c } = await admin
    .from("clients")
    .upsert({ name: "ArchiveRLSClient" }, { onConflict: "name" })
    .select("id")
    .single();
  clientId = c!.id;

  const { data: p1 } = await admin
    .from("projects")
    .upsert(
      { name: "Active P", code: "ARLS-A", client_id: clientId, archived_at: null },
      { onConflict: "code" },
    )
    .select("id")
    .single();
  activeProjectId = p1!.id;

  const { data: p2 } = await admin
    .from("projects")
    .upsert(
      {
        name: "Archived P",
        code: "ARLS-Z",
        client_id: clientId,
        archived_at: new Date().toISOString(),
      },
      { onConflict: "code" },
    )
    .select("id")
    .single();
  archivedProjectId = p2!.id;

  await admin.from("project_members").upsert(
    [
      { project_id: activeProjectId, user_id: staffId, project_role: "member" },
      { project_id: archivedProjectId, user_id: staffId, project_role: "member" },
    ],
    { onConflict: "project_id,user_id" },
  );
}, 60_000);

describe("archive RLS", () => {
  it("staff sees active project but not archived one", async () => {
    const sb = await clientAs(STAFF);
    const { data } = await sb.from("projects").select("id, code");
    const codes = (data ?? []).map((r) => r.code);
    expect(codes).toContain("ARLS-A");
    expect(codes).not.toContain("ARLS-Z");
  });

  it("admin still sees archived project", async () => {
    const admin = adminClient();
    const { data } = await admin
      .from("projects")
      .select("id, code")
      .in("code", ["ARLS-A", "ARLS-Z"]);
    const codes = (data ?? []).map((r) => r.code);
    expect(codes).toContain("ARLS-A");
    expect(codes).toContain("ARLS-Z");
  });
});
```

- [ ] **Step 2: Run**

```powershell
npm test -- tests/integration/admin-rls.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 3: Run the full suite to confirm nothing else broke**

```powershell
npm test
```

Expected: all tests pass (smoke, auth, middleware, schemas, rls, admin-actions, admin-rls).

- [ ] **Step 4: Commit**

```powershell
git add tests/integration/admin-rls.test.ts
git commit -m "test: archive RLS hides archived projects from non-admins"
```

---

## Task 14: Manual smoke test of the full flow

**Files:** none.

This is end-to-end verification before declaring Plan 2 done.

- [ ] **Step 1: Run dev server**

```powershell
npm run dev
```

- [ ] **Step 2: Log in as the seeded admin**

Open `http://localhost:3000/login`, sign in with the existing admin credentials. You should land on `/admin` with the overview cards.

- [ ] **Step 3: Create a client**

Go to **Clients → New client**. Create "SOCO Test Client" with a contact email. Confirm it appears in the list.

- [ ] **Step 4: Create a project**

**Projects → New project**. Name "SOCO Test", code "SOCOT", pick the client just created, status "planning". Save. You should land on the edit page.

- [ ] **Step 5: Invite a staff user**

**Users → Invite user**. Use an email you control (or an alias). Pick role **Staff**. Submit. Confirm:
- A toast says "Invite sent"
- The user row appears in the users table with role `staff` and status `active`
- The invitee's inbox has the Supabase invite email

- [ ] **Step 6: Assign that staff user to the project**

Open the project → **Manage team →** click **Add staff member**, pick the user, click Add. Confirm the member appears in the team table.

- [ ] **Step 7: Invite a client viewer for the project**

On the team page, click **Invite client viewer**. Use a different email. Submit. Confirm:
- The client viewer appears in the team table with project role `viewer` and global role `client`
- A second invite email arrives

- [ ] **Step 8: Verify role gating from the invitee side**

Open the staff invite email in a private window, click the link, set a password, get redirected. You should land on `/workspace` (Plan 3 placeholder), NOT `/admin` or `/portal`. Visiting `/admin` directly should redirect back to `/workspace`.

Repeat with the client invite — expect to land on `/portal`, with `/admin` and `/workspace` both redirecting away.

- [ ] **Step 9: Verify archive hides things from the staff user**

In the admin window, archive the project. In the staff window, refresh `/workspace` — the project should disappear from any list it had been showing (Plan 3 will surface it; for now confirm by querying):

```powershell
# Optional: open the staff browser devtools console and run
# fetch('/api/...').then(...)
# — but the simplest check is: as the staff user, navigate to /admin/projects/<id>
# and confirm you get redirected away (not allowed to see admin URLs at all).
```

The archive RLS integration test already verifies the database side; this step just confirms middleware still gates correctly.

Restore the project before moving on.

- [ ] **Step 10: Verify build still clean**

```powershell
npm run build
```

- [ ] **Step 11: Final commit (if any cleanup was needed)**

If the smoke test surfaced bugs and you fixed them, commit those fixes. Otherwise, no commit needed — just mark the task done.

---

## Verification (end of plan)

After all tasks:

1. `npm run build` succeeds.
2. `npm test` — all tests pass: schemas, integration admin-actions, integration admin-rls, plus everything from Plan 1.
3. Migrations `0005` and `0006` applied to the linked Supabase project.
4. Manual smoke test (Task 14) completed end-to-end: invite → create client → create project → assign staff → invite client viewer → role-gated logins all work.
5. Archived rows do not appear in non-admin queries (verified by `admin-rls.test.ts`).
6. The seeded admin can prepare the SOCO project shell so Plan 3 (Workspace + Activity Flow) can begin.

After this plan ships, **Plan 3 (Workspace + Activity Flow)** picks up by adding phases, activities, proof uploads, and mark-done flows under `/workspace/projects/[id]/*`.

---

## Self-Review Notes

- **Spec coverage:**
  - §3 (locked decisions) — invite mechanism (Task 9), layout (Task 4), forms stack (Task 3 + every form), archive semantics (Tasks 1, 2, 7, 8) all implemented.
  - §4 (schema changes) — Task 1.
  - §5 (routes & file layout) — every route in the spec has a task.
  - §6 (key flows) — 6.1 invite (Task 9), 6.2 staff member (Task 10), 6.3 client viewer (Task 10), 6.4 archive/restore (Tasks 7, 8), 6.5 deactivate (Task 9), 6.6 overview (Task 11) all covered.
  - §7 (testing strategy) — unit tests Task 5, integration Tasks 12 & 13, manual smoke Task 14.
  - §8 (task breakdown) — sequenced through Tasks 1-14.
  - §10 (success criteria) — verified at end-of-plan checklist.
- **Type/name consistency:** `clientFormSchema`, `projectFormSchema`, `inviteUserSchema`, `assignMemberSchema`, `inviteClientViewerSchema`, `setUserRoleSchema` all defined in Task 5 and used by name in Tasks 7, 8, 9, 10. `ActionResult` shape repeated identically across action files (intentional — each action file is self-contained).
- **Placeholder check:** Every code block is complete; no "TBD"/"TODO". Two fallback notes in Tasks 6 and 10 give the engineer concrete alternative code if FK-named embeds fail at runtime — this is contingency code, not a placeholder.
- **Known runtime dependency:** the Supabase invite email is sent by Supabase's default SMTP. The user has confirmed this is fine for v1 (spec §2 — open items mentions branded sender as deferred).
