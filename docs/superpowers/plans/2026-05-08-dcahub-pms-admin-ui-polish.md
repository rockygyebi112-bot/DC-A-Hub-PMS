# DC&A Hub PMS — Plan 2.5: Admin UI Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift the admin console from "functional" to "polished" — collapsible grouped sidebar with count badges, breadcrumbs + theme toggle topbar, redesigned overview dashboard, sectioned forms with sticky save bar, status pills, light/dark theme refinement, and tablet-responsive layout. No new features or schema changes.

**Architecture:** Add CSS tokens, build a small set of pure presentation primitives in `src/components/admin/ui/`, rewrite the AdminShell topbar and sidebar, then refactor each admin page to compose the new primitives in a consistent shell-header-content pattern. `next-themes` is already wired in `src/app/providers.tsx`.

**Tech Stack:** Next.js 16 App Router, shadcn base-nova (uses `@base-ui/react` primitives with `render` prop, NOT `asChild`), Tailwind v4, lucide-react, next-themes, sonner. No new packages.

**Spec:** [`docs/superpowers/specs/2026-05-08-dcahub-pms-admin-ui-polish-design.md`](../specs/2026-05-08-dcahub-pms-admin-ui-polish-design.md)

---

## File Structure (after this plan)

```
src/
  app/
    globals.css                                  # MOD — add admin + status tokens
    admin/
      layout.tsx                                 # MOD — fetch counts, pass to sidebar
      page.tsx                                   # MOD — overview redesign
      clients/
        page.tsx                                 # MOD
        new/page.tsx                             # MOD
        [id]/page.tsx                            # MOD
      projects/
        page.tsx                                 # MOD
        new/page.tsx                             # MOD
        [id]/
          page.tsx                               # MOD
          team/page.tsx                          # MOD
      users/
        page.tsx                                 # MOD
        [id]/page.tsx                            # MOD
  components/
    admin/
      admin-shell.tsx                            # MOD — uses AdminTopbar
      admin-sidebar.tsx                          # MOD — collapsible + grouped + counts
      ui/
        page-header.tsx                          # NEW
        section-card.tsx                         # NEW
        stat-card.tsx                            # NEW
        status-pill.tsx                          # NEW
        user-avatar.tsx                          # NEW
        breadcrumbs.tsx                          # NEW
        admin-topbar.tsx                         # NEW
        user-dropdown.tsx                        # NEW
        sidebar-toggle.tsx                       # NEW
        theme-toggle.tsx                         # NEW
        filter-chips.tsx                         # NEW
        list-search.tsx                          # NEW
        sticky-form-bar.tsx                      # NEW
      forms/
        client-form.tsx                          # MOD — wrap in SectionCard, sticky bar
        project-form.tsx                         # MOD — three SectionCards, sticky bar
        invite-user-form.tsx                     # unchanged (already in dialog)
        invite-client-viewer-form.tsx            # unchanged
        assign-member-form.tsx                   # unchanged
    empty-state.tsx                              # MOD — extend with icon + action props
  lib/
    admin/
      queries.ts                                 # MOD — add getAdminCounts() + project_count on listClients
```

No tests change. No migrations. No new dependencies.

---

## Task 1: Design tokens + verify theme provider

**Files:**
- Modify: `src/app/globals.css`

`next-themes` is already wired in `src/app/providers.tsx`. This task only adds the tokens and confirms the toggle path works.

- [ ] **Step 1: Add admin density and status tokens to `:root`**

Open `src/app/globals.css`. Find the `:root {` block (around line 80 in current file). Append these lines just before the closing `}` of `:root`:

```css
  /* admin density */
  --admin-row-h: 44px;
  --admin-card-radius: 12px;

  /* status colors (light) */
  --status-planning: hsl(220 13% 70%);
  --status-active:   hsl(104 53% 49%);
  --status-paused:   hsl(38 92% 50%);
  --status-completed: hsl(220 13% 50%);
  --status-archived: hsl(220 13% 80%);
```

- [ ] **Step 2: Add the dark variants**

Find the `.dark {` block in the same file. Append these lines just before its closing `}`:

```css
  /* status colors (dark) */
  --status-planning: hsl(220 13% 45%);
  --status-active:   hsl(104 55% 52%);
  --status-paused:   hsl(38 92% 55%);
  --status-completed: hsl(220 13% 55%);
  --status-archived: hsl(220 13% 35%);
```

- [ ] **Step 3: Verify build**

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```powershell
git add src/app/globals.css
git commit -m "feat(ui): add admin density and status color tokens"
```

---

## Task 2: Pure presentation primitives (PageHeader, SectionCard, StatusPill, UserAvatar)

**Files:**
- Create: `src/components/admin/ui/page-header.tsx`
- Create: `src/components/admin/ui/section-card.tsx`
- Create: `src/components/admin/ui/status-pill.tsx`
- Create: `src/components/admin/ui/user-avatar.tsx`

These are pure JSX-from-props components. No data fetching, no client-only state.

- [ ] **Step 1: Create `page-header.tsx`**

```tsx
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 mb-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
```

- [ ] **Step 2: Create `section-card.tsx`**

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  children,
  tone = "default",
  action,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "destructive";
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--admin-card-radius)] border bg-card text-card-foreground shadow-sm",
        tone === "destructive" && "border-destructive/30",
      )}
    >
      {(title || description || action) && (
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b">
          <div className="space-y-1">
            {title && (
              <h2
                className={cn(
                  "text-base font-semibold",
                  tone === "destructive" && "text-destructive",
                )}
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
```

- [ ] **Step 3: Create `status-pill.tsx`**

```tsx
import { cn } from "@/lib/utils";

type Status =
  | "planning"
  | "active"
  | "paused"
  | "completed"
  | "archived"
  | "active-user"
  | "inactive-user"
  | "admin"
  | "staff"
  | "client"
  | "member"
  | "viewer";

const STYLES: Record<Status, string> = {
  planning: "bg-[var(--status-planning)]/15 text-foreground border-[var(--status-planning)]/40",
  active: "bg-[var(--status-active)]/15 text-[var(--status-active)] border-[var(--status-active)]/40",
  paused: "bg-[var(--status-paused)]/15 text-[var(--status-paused)] border-[var(--status-paused)]/40",
  completed: "bg-[var(--status-completed)]/15 text-foreground border-[var(--status-completed)]/40",
  archived: "bg-[var(--status-archived)]/30 text-muted-foreground border-[var(--status-archived)]/60",
  "active-user": "bg-[var(--status-active)]/15 text-[var(--status-active)] border-[var(--status-active)]/40",
  "inactive-user": "bg-muted text-muted-foreground border-border",
  admin: "bg-primary/15 text-primary border-primary/40",
  staff: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40",
  client: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/40",
  member: "bg-[var(--status-active)]/15 text-[var(--status-active)] border-[var(--status-active)]/40",
  viewer: "bg-muted text-foreground border-border",
};

const LABELS: Partial<Record<Status, string>> = {
  "active-user": "Active",
  "inactive-user": "Inactive",
};

export function StatusPill({ status }: { status: Status }) {
  const label = LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        STYLES[status],
      )}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Create `user-avatar.tsx`**

```tsx
import { cn } from "@/lib/utils";

const SIZES = { sm: "size-7 text-xs", md: "size-9 text-sm", lg: "size-12 text-base" };

const PALETTE = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
];

function hashToColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  email,
  name,
  size = "md",
  className,
}: {
  email: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const color = hashToColor(email);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium text-white shrink-0",
        SIZES[size],
        color,
        className,
      )}
      title={name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
```

- [ ] **Step 5: Verify build**

```powershell
npm run build
```

Expected: build succeeds (no consumers yet, but new files type-check).

- [ ] **Step 6: Commit**

```powershell
git add src/components/admin/ui
git commit -m "feat(ui): add PageHeader, SectionCard, StatusPill, UserAvatar primitives"
```

---

## Task 3: Topbar primitives (Breadcrumbs, ThemeToggle, UserDropdown, AdminTopbar) and StatCard

**Files:**
- Create: `src/components/admin/ui/breadcrumbs.tsx`
- Create: `src/components/admin/ui/theme-toggle.tsx`
- Create: `src/components/admin/ui/user-dropdown.tsx`
- Create: `src/components/admin/ui/admin-topbar.tsx`
- Create: `src/components/admin/ui/stat-card.tsx`

- [ ] **Step 1: Create `breadcrumbs.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

type Crumb = { href: string; label: string };

const STATIC_LABELS: Record<string, string> = {
  admin: "Admin",
  clients: "Clients",
  projects: "Projects",
  users: "Users",
  team: "Team",
  new: "New",
};

export function Breadcrumbs({
  trail,
}: {
  trail?: Crumb[];
}) {
  const pathname = usePathname();
  const segments = trail ?? buildTrailFromPath(pathname);

  if (segments.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {segments.map((c, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={c.href} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="size-3.5 text-muted-foreground" />
            )}
            {isLast ? (
              <span className="font-medium text-foreground">{c.label}</span>
            ) : (
              <Link
                href={c.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function buildTrailFromPath(pathname: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let acc = "";
  for (const p of parts) {
    acc += "/" + p;
    const label =
      STATIC_LABELS[p] ??
      (p.length > 12 && /^[0-9a-f-]+$/i.test(p) ? "Detail" : p);
    crumbs.push({ href: acc, label });
  }
  return crumbs;
}
```

- [ ] **Step 2: Create `theme-toggle.tsx`**

```tsx
"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
```

- [ ] **Step 3: Create `user-dropdown.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { UserAvatar } from "./user-avatar";
import { createClient } from "@/lib/supabase/client";

export function UserDropdown({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      const sb = createClient();
      await sb.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-2 px-2">
            <UserAvatar email={email} name={name} size="sm" />
            <span className="hidden md:inline text-sm">{name}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <User className="mr-2 size-4" /> Account (coming soon)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} disabled={pending}>
          <LogOut className="mr-2 size-4" />
          {pending ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

If the existing `dropdown-menu.tsx` uses a different trigger pattern (no `render` prop), open `src/components/ui/dropdown-menu.tsx` to confirm the prop name. base-ui dropdown menus accept either `render` or have the trigger wrap a child directly. If `render` doesn't compile, fall back to `<DropdownMenuTrigger><Button>...</Button></DropdownMenuTrigger>`.

- [ ] **Step 4: Create `admin-topbar.tsx`**

```tsx
import { Breadcrumbs } from "./breadcrumbs";
import { ThemeToggle } from "./theme-toggle";
import { UserDropdown } from "./user-dropdown";

export function AdminTopbar({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  return (
    <header className="h-14 border-b flex items-center justify-between px-4 md:px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
      <Breadcrumbs />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserDropdown name={name} email={email} />
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Create `stat-card.tsx`**

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number | string;
  href?: string;
  hint?: string;
}) {
  const body = (
    <div className="rounded-[var(--admin-card-radius)] border bg-card p-5 shadow-sm transition-colors hover:bg-accent/30">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className={cn("block")}>
      {body}
    </Link>
  );
}
```

- [ ] **Step 6: Verify build**

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```powershell
git add src/components/admin/ui
git commit -m "feat(ui): add Breadcrumbs, ThemeToggle, UserDropdown, AdminTopbar, StatCard"
```

---

## Task 4: List & form helpers (FilterChips, ListSearch, StickyFormBar) + EmptyState extension + SidebarToggle

**Files:**
- Create: `src/components/admin/ui/filter-chips.tsx`
- Create: `src/components/admin/ui/list-search.tsx`
- Create: `src/components/admin/ui/sticky-form-bar.tsx`
- Create: `src/components/admin/ui/sidebar-toggle.tsx`
- Modify: `src/components/empty-state.tsx`

- [ ] **Step 1: Create `filter-chips.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function FilterChips({
  paramName,
  options,
  allLabel = "All",
}: {
  paramName: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const current = params.get(paramName) ?? "";

  function go(value: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (!value) next.delete(paramName);
    else next.set(paramName, value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const items = [{ value: "", label: allLabel }, ...options];
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => {
        const selected = it.value === current;
        return (
          <button
            key={it.value || "all"}
            type="button"
            onClick={() => go(it.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `list-search.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

export function ListSearch({
  placeholder = "Search...",
  paramName = "q",
}: {
  placeholder?: string;
  paramName?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [value, setValue] = useState(params.get(paramName) ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(Array.from(params.entries()));
      if (!value) next.delete(paramName);
      else next.set(paramName, value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-8 h-8 w-64"
      />
    </div>
  );
}
```

- [ ] **Step 3: Create `sticky-form-bar.tsx`**

```tsx
"use client";

import type { ReactNode } from "react";

export function StickyFormBar({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  if (!visible) return null;
  return (
    <div className="sticky bottom-0 -mx-6 md:-mx-8 mt-6 border-t bg-background/95 px-6 md:px-8 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 z-10">
      <div className="flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Create `sidebar-toggle.tsx`**

```tsx
"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onToggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="self-end"
    >
      {collapsed ? (
        <ChevronsRight className="size-4" />
      ) : (
        <ChevronsLeft className="size-4" />
      )}
    </Button>
  );
}
```

- [ ] **Step 5: Read existing `empty-state.tsx`**

```powershell
Get-Content src\components\empty-state.tsx
```

Note its current props/signature.

- [ ] **Step 6: Replace `empty-state.tsx` with the extended version**

```tsx
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-3 text-muted-foreground">
          <Icon className="size-6" />
        </div>
      )}
      <h3 className="text-base font-medium">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-md">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
```

If existing callers in the codebase rely on a different signature, run a quick check:

```powershell
Select-String -Path src -Recurse -Pattern "EmptyState" -Include *.tsx
```

If any caller breaks, update it to the new signature in the same commit.

- [ ] **Step 7: Verify build**

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 8: Commit**

```powershell
git add src/components/admin/ui src/components/empty-state.tsx
git commit -m "feat(ui): add list/form helpers and extend EmptyState"
```

---

## Task 5: Extend queries to provide counts for sidebar and overview

**Files:**
- Modify: `src/lib/admin/queries.ts`

The new sidebar shows count badges. The overview shows pending-invites and active-projects counts. Add helpers.

- [ ] **Step 1: Append a `getAdminCounts` helper to `queries.ts`**

Open `src/lib/admin/queries.ts`. Append:

```ts
export type AdminCounts = {
  activeClients: number;
  activeProjects: number;
  totalUsers: number;
  pendingInvites: number;
};

export async function getAdminCounts(): Promise<AdminCounts> {
  const sb = await createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [clientsRes, projectsRes, usersRes, invitesRes] = await Promise.all([
    sb.from("clients").select("*", { count: "exact", head: true }).is("archived_at", null),
    sb.from("projects").select("*", { count: "exact", head: true }).is("archived_at", null),
    sb.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
    sb
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
  ]);

  return {
    activeClients: clientsRes.count ?? 0,
    activeProjects: projectsRes.count ?? 0,
    totalUsers: usersRes.count ?? 0,
    pendingInvites: invitesRes.count ?? 0,
  };
}
```

- [ ] **Step 2: Replace `listClients` to also return per-client active project count**

Find the existing `listClients` function and replace it with:

```ts
export async function listClients(opts: { includeArchived?: boolean } = {}) {
  const sb = await createClient();
  const q = sb
    .from("clients")
    .select(
      "id, name, contact_email, archived_at, created_at, projects(id, archived_at)",
    )
    .order("name", { ascending: true });
  if (!opts.includeArchived) q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((c) => {
    const projects = (c.projects ?? []) as { id: string; archived_at: string | null }[];
    const projectCount = projects.filter((p) => p.archived_at === null).length;
    const { projects: _, ...rest } = c;
    return { ...rest, project_count: projectCount };
  });
}
```

- [ ] **Step 3: Append a recent-projects helper**

Append to `queries.ts`:

```ts
export async function listRecentProjects(limit = 5) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("projects")
    .select("id, name, code, status, created_at")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 4: Verify build**

```powershell
npm run build
```

Expected: build succeeds. The existing `/admin/clients` page already calls `listClients` and uses fields `id`, `name`, `contact_email`, `archived_at` — those still work; the new `project_count` is just an extra field, opt-in for callers.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/admin/queries.ts
git commit -m "feat(admin): add count helpers and per-client project_count"
```

---

## Task 6: AdminShell + AdminSidebar rewrite

**Files:**
- Modify: `src/components/admin/admin-shell.tsx`
- Modify: `src/components/admin/admin-sidebar.tsx`
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Replace `admin-shell.tsx`**

```tsx
import type { ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./ui/admin-topbar";
import type { AdminCounts } from "@/lib/admin/queries";

export function AdminShell({
  children,
  name,
  email,
  counts,
}: {
  children: ReactNode;
  name: string;
  email: string;
  counts: AdminCounts;
}) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar counts={counts} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar name={name} email={email} />
        <main key={name} className="flex-1 p-6 md:p-8 animate-in fade-in duration-100">
          {children}
        </main>
      </div>
    </div>
  );
}
```

(`tw-animate-css` is already imported in `globals.css`, so `animate-in` and `fade-in` utilities work.)

- [ ] **Step 2: Replace `admin-sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarToggle } from "./ui/sidebar-toggle";
import type { AdminCounts } from "@/lib/admin/queries";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  countKey?: keyof AdminCounts;
};

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/admin/clients", label: "Clients", icon: Building2, countKey: "activeClients" },
      { href: "/admin/projects", label: "Projects", icon: FolderKanban, countKey: "activeProjects" },
      { href: "/admin/users", label: "Users", icon: Users, countKey: "totalUsers" },
    ],
  },
];

const STORAGE_KEY = "admin.sidebar.collapsed";

export function AdminSidebar({ counts }: { counts: AdminCounts }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 border-r bg-muted/40 transition-[width] duration-150",
        collapsed ? "w-16 px-2" : "w-60 px-3",
        "py-4",
      )}
    >
      <div className={cn("mb-6", collapsed ? "px-1" : "px-2")}>
        <p className={cn("text-sm font-semibold truncate", collapsed && "sr-only")}>
          DC&amp;A Hub PMS
        </p>
        <p className={cn("text-xs text-muted-foreground", collapsed && "sr-only")}>
          Admin Console
        </p>
      </div>

      <nav className="flex-1 flex flex-col gap-4">
        {GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            {!collapsed && (
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              const count = item.countKey ? counts[item.countKey] : undefined;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    collapsed && "justify-center px-2",
                    active
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background hover:text-foreground",
                  )}
                >
                  {active && (
                    <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-primary" />
                  )}
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {typeof count === "number" && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {count}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <SidebarToggle collapsed={collapsed} onToggle={toggle} />
    </aside>
  );
}
```

- [ ] **Step 3: Update `app/admin/layout.tsx`**

Replace the file with:

```tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getAdminCounts } from "@/lib/admin/queries";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const counts = await getAdminCounts();

  return (
    <AdminShell name={profile.fullName} email={profile.email} counts={counts}>
      {children}
    </AdminShell>
  );
}
```

- [ ] **Step 4: Verify build**

```powershell
npm run build
```

Expected: build succeeds. Visit `/admin` in dev — sidebar shows two groups with counts, collapse toggle works at the bottom, topbar shows user dropdown and theme toggle.

- [ ] **Step 5: Commit**

```powershell
git add src/components/admin/admin-shell.tsx src/components/admin/admin-sidebar.tsx src/app/admin/layout.tsx
git commit -m "feat(admin): collapsible grouped sidebar with counts and new topbar"
```

---

## Task 7: Overview page redesign

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Replace `src/app/admin/page.tsx`**

```tsx
import Link from "next/link";
import {
  Building2,
  FolderKanban,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatCard } from "@/components/admin/ui/stat-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import {
  getAdminCounts,
  listRecentProjects,
} from "@/lib/admin/queries";
import { createClient } from "@/lib/supabase/server";

type FeedEntry = {
  id: string;
  action: string;
  created_at: string;
  projectName: string | null;
  actorName: string | null;
  actorEmail: string | null;
};

async function getFeed(): Promise<FeedEntry[]> {
  const sb = await createClient();
  const { data: rows } = await sb
    .from("activity_log")
    .select("id, action, created_at, project_id, actor_user_id")
    .order("created_at", { ascending: false })
    .limit(10);
  if (!rows || rows.length === 0) return [];
  const projectIds = Array.from(new Set(rows.map((r) => r.project_id).filter(Boolean)));
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_user_id).filter(Boolean) as string[]),
  );
  const [projectsRes, profilesRes] = await Promise.all([
    projectIds.length
      ? sb.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    actorIds.length
      ? sb.from("profiles").select("user_id, full_name, email").in("user_id", actorIds)
      : Promise.resolve({ data: [] as { user_id: string; full_name: string; email: string }[] }),
  ]);
  const projectById = new Map((projectsRes.data ?? []).map((p) => [p.id, p.name]));
  const actorByUserId = new Map(
    (profilesRes.data ?? []).map((p) => [p.user_id, { name: p.full_name, email: p.email }]),
  );
  return rows.map((r) => {
    const actor = r.actor_user_id ? actorByUserId.get(r.actor_user_id) : undefined;
    return {
      id: r.id,
      action: r.action,
      created_at: r.created_at,
      projectName: r.project_id ? projectById.get(r.project_id) ?? null : null,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
    };
  });
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function AdminOverview() {
  const [profile, counts, feed, recent] = await Promise.all([
    getCurrentProfile(),
    getAdminCounts(),
    getFeed(),
    listRecentProjects(5),
  ]);

  const firstName = profile?.fullName.split(" ")[0] ?? "there";
  const summary = `${counts.activeProjects} active project${counts.activeProjects === 1 ? "" : "s"} across ${counts.activeClients} client${counts.activeClients === 1 ? "" : "s"}.`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}.`}
        subtitle={summary}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active projects" value={counts.activeProjects} href="/admin/projects" />
        <StatCard label="Active users" value={counts.totalUsers} href="/admin/users" />
        <StatCard label="Clients" value={counts.activeClients} href="/admin/clients" />
        <StatCard
          label="Pending invites"
          value={counts.pendingInvites}
          hint="last 7 days"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionCard title="Recent activity">
            {feed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {feed.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 text-sm">
                    {row.actorEmail && row.actorName ? (
                      <UserAvatar email={row.actorEmail} name={row.actorName} size="sm" />
                    ) : (
                      <span className="size-7 rounded-full bg-muted" />
                    )}
                    <span className="font-medium">{row.actorName ?? "system"}</span>
                    <Badge variant="outline" className="capitalize">
                      {row.action.replace(/_/g, " ")}
                    </Badge>
                    <span className="text-muted-foreground">{row.projectName ?? "—"}</span>
                    <span className="ml-auto text-muted-foreground text-xs">
                      {timeAgo(row.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Quick actions">
            <div className="flex flex-col gap-2">
              <Button render={<Link href="/admin/clients/new" />} className="w-full justify-start">
                <Building2 className="mr-2 size-4" /> New client
              </Button>
              <Button render={<Link href="/admin/projects/new" />} className="w-full justify-start">
                <FolderKanban className="mr-2 size-4" /> New project
              </Button>
              <Button
                render={<Link href="/admin/users" />}
                variant="secondary"
                className="w-full justify-start"
              >
                <UserPlus className="mr-2 size-4" /> Invite user
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Recently created">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="space-y-2">
                {recent.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <Link
                      href={`/admin/projects/${p.id}`}
                      className="font-medium hover:underline truncate"
                    >
                      {p.name}
                    </Link>
                    <code className="text-xs text-muted-foreground">{p.code}</code>
                    <StatusPill
                      status={p.status as "planning" | "active" | "paused" | "completed"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```powershell
npm run build
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/admin/page.tsx
git commit -m "feat(admin): redesigned overview with stat cards, activity feed, quick actions"
```

---

## Task 8: Clients pages refactor

**Files:**
- Modify: `src/app/admin/clients/page.tsx`
- Modify: `src/app/admin/clients/new/page.tsx`
- Modify: `src/app/admin/clients/[id]/page.tsx`
- Modify: `src/components/admin/forms/client-form.tsx`

- [ ] **Step 1: Replace `src/app/admin/clients/page.tsx`**

```tsx
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { EmptyState } from "@/components/empty-state";
import { listClients } from "@/lib/admin/queries";
import { ArchiveToggle } from "@/components/admin/archive-toggle";
import { ListSearch } from "@/components/admin/ui/list-search";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const includeArchived = sp.archived === "1";
  const all = await listClients({ includeArchived });
  const q = (sp.q ?? "").toLowerCase().trim();
  const rows = q
    ? all.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.contact_email ?? "").toLowerCase().includes(q),
      )
    : all;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Organisations DC&A Hub serves"
        action={
          <Button render={<Link href="/admin/clients/new" />}>New client</Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ListSearch placeholder="Search clients..." />
          <span className="text-xs text-muted-foreground">
            {rows.length} client{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <ArchiveToggle />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={q ? "No clients match your search" : "No clients yet"}
          description={
            q
              ? "Try a different name or contact email."
              : "Add the first organisation DC&A Hub serves."
          }
          action={
            !q ? (
              <Button render={<Link href="/admin/clients/new" />}>
                Create your first client
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact email</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow
                key={c.id}
                className={c.archived_at ? "opacity-60" : ""}
                style={{ height: "var(--admin-row-h)" }}
              >
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.contact_email ?? "—"}</TableCell>
                <TableCell>{c.project_count}</TableCell>
                <TableCell>
                  <StatusPill status={c.archived_at ? "archived" : "active"} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/admin/clients/${c.id}`} />}
                  >
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/admin/clients/new/page.tsx`**

```tsx
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ClientForm } from "@/components/admin/forms/client-form";

export default function NewClientPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="New client" subtitle="Create a client organisation" />
      <SectionCard title="Basics">
        <ClientForm mode="create" />
      </SectionCard>
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/app/admin/clients/[id]/page.tsx`**

```tsx
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
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
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={c.name}
        subtitle={c.contact_email ?? undefined}
        action={<StatusPill status={c.archived_at ? "archived" : "active"} />}
      />

      <SectionCard title="Basics">
        <ClientForm
          mode="edit"
          initial={{
            id: c.id,
            name: c.name,
            contact_email: c.contact_email ?? "",
            logo_url: c.logo_url ?? "",
          }}
        />
      </SectionCard>

      <SectionCard
        title="Danger zone"
        description="Archived clients are hidden from non-admin users. Their projects keep running unless archived separately."
        tone="destructive"
      >
        <form action={c.archived_at ? restore : archive}>
          <Button
            type="submit"
            variant={c.archived_at ? "default" : "destructive"}
          >
            {c.archived_at ? "Restore client" : "Archive client"}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
```

- [ ] **Step 4: Update `src/components/admin/forms/client-form.tsx` to add a sticky save bar**

Open the file and replace the bottom button block with a sticky bar. Find:

```tsx
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </Button>
        </div>
```

Replace with:

```tsx
        <StickyFormBar visible={form.formState.isDirty || pending}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => form.reset()}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </Button>
        </StickyFormBar>
```

Add the import at the top of the file:

```tsx
import { StickyFormBar } from "@/components/admin/ui/sticky-form-bar";
```

- [ ] **Step 5: Verify build**

```powershell
npm run build
```

- [ ] **Step 6: Commit**

```powershell
git add src/app/admin/clients src/components/admin/forms/client-form.tsx
git commit -m "feat(admin): refactor clients pages with PageHeader, SectionCard, sticky save bar"
```

---

## Task 9: Projects pages refactor

**Files:**
- Modify: `src/app/admin/projects/page.tsx`
- Modify: `src/app/admin/projects/new/page.tsx`
- Modify: `src/app/admin/projects/[id]/page.tsx`
- Modify: `src/components/admin/forms/project-form.tsx`

- [ ] **Step 1: Replace `src/app/admin/projects/page.tsx`**

```tsx
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { ListSearch } from "@/components/admin/ui/list-search";
import { FilterChips } from "@/components/admin/ui/filter-chips";
import { EmptyState } from "@/components/empty-state";
import { listProjects } from "@/lib/admin/queries";
import { ArchiveToggle } from "@/components/admin/archive-toggle";

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const all = await listProjects({ includeArchived: sp.archived === "1" });
  const q = (sp.q ?? "").toLowerCase().trim();
  const statusFilter = sp.status ?? "";
  const rows = all.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) {
      return false;
    }
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="All projects across clients"
        action={
          <Button render={<Link href="/admin/projects/new" />}>New project</Button>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ListSearch placeholder="Search by name or code..." />
          <ArchiveToggle />
        </div>
        <FilterChips paramName="status" options={STATUS_OPTIONS} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={q || statusFilter ? "No projects match" : "No projects yet"}
          description={
            q || statusFilter
              ? "Adjust your filters or search."
              : "Spin up the first project shell — phases and activities follow in Plan 3."
          }
          action={
            !q && !statusFilter ? (
              <Button render={<Link href="/admin/projects/new" />}>
                Create your first project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow
                key={p.id}
                className={p.archived_at ? "opacity-60" : ""}
                style={{ height: "var(--admin-row-h)" }}
              >
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <code className="text-xs">{p.code}</code>
                </TableCell>
                <TableCell>{p.client?.name ?? "—"}</TableCell>
                <TableCell>
                  <StatusPill
                    status={
                      p.archived_at
                        ? "archived"
                        : (p.status as "planning" | "active" | "paused" | "completed")
                    }
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.start_date ?? "—"} — {p.end_date ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/admin/projects/${p.id}`} />}
                  >
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/admin/projects/new/page.tsx`**

```tsx
import { PageHeader } from "@/components/admin/ui/page-header";
import { ProjectForm } from "@/components/admin/forms/project-form";
import { listClients } from "@/lib/admin/queries";

export default async function NewProjectPage() {
  const clients = await listClients();
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="New project" subtitle="Set up the project shell" />
      <ProjectForm
        mode="create"
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/app/admin/projects/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { ProjectForm } from "@/components/admin/forms/project-form";
import { getProject, listClients } from "@/lib/admin/queries";
import {
  archiveProject,
  restoreProject,
} from "@/lib/admin/actions/projects";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [p, clients] = await Promise.all([
    getProject(id),
    listClients({ includeArchived: true }),
  ]);

  async function archive() {
    "use server";
    await archiveProject(id);
  }
  async function restore() {
    "use server";
    await restoreProject(id);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={p.name}
        subtitle={p.client?.name ?? undefined}
        action={
          <div className="flex items-center gap-3">
            <code className="text-xs text-muted-foreground">{p.code}</code>
            <StatusPill
              status={
                p.archived_at
                  ? "archived"
                  : (p.status as "planning" | "active" | "paused" | "completed")
              }
            />
            <Button
              variant="secondary"
              size="sm"
              render={<Link href={`/admin/projects/${id}/team`} />}
            >
              Manage team
            </Button>
          </div>
        }
      />

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

      <SectionCard
        title="Danger zone"
        description="Archived projects are hidden from non-admin users."
        tone="destructive"
      >
        <form action={p.archived_at ? restore : archive}>
          <Button
            type="submit"
            variant={p.archived_at ? "default" : "destructive"}
          >
            {p.archived_at ? "Restore project" : "Archive project"}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
```

- [ ] **Step 4: Replace `src/components/admin/forms/project-form.tsx`**

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
import { SectionCard } from "@/components/admin/ui/section-card";
import { StickyFormBar } from "@/components/admin/ui/sticky-form-bar";
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
        form.reset(values);
        router.refresh();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <SectionCard title="Basics">
          <div className="space-y-4">
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
                <Select value={field.value || undefined} onValueChange={field.onChange}>
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
                <Select value={field.value} onValueChange={field.onChange}>
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
          </div>
        </SectionCard>

        <SectionCard title="Schedule" description="Optional start and end dates">
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
        </SectionCard>

        <SectionCard title="Description">
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
              <FormControl><Textarea rows={4} placeholder="What is this project about?" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </SectionCard>

        <StickyFormBar visible={form.formState.isDirty || pending}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => form.reset()}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </Button>
        </StickyFormBar>
      </form>
    </Form>
  );
}
```

- [ ] **Step 5: Verify build**

```powershell
npm run build
```

- [ ] **Step 6: Commit**

```powershell
git add src/app/admin/projects src/components/admin/forms/project-form.tsx
git commit -m "feat(admin): refactor projects pages with sectioned forms and filter chips"
```

---

## Task 10: Project team page refactor

**Files:**
- Modify: `src/app/admin/projects/[id]/team/page.tsx`

The "Add to team ▾" dropdown is harder to wire than three plain buttons because each candidate set is different and we have an existing `AssignMemberForm` and `InviteClientViewerForm`. Keep the three triggers but place them as siblings in a header action; render them inline (not full-width). Visual unification is enough.

- [ ] **Step 1: Replace `src/app/admin/projects/[id]/team/page.tsx`**

```tsx
import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { EmptyState } from "@/components/empty-state";
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
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={`${project.name} — Team`}
        subtitle={`${members.length} member${members.length === 1 ? "" : "s"}`}
        action={
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/admin/projects/${id}`} />}
          >
            ← Back to project
          </Button>
        }
      />

      <SectionCard
        title="Team"
        description="Staff get full read/write. Client viewers see read-only progress."
        action={
          <div className="flex flex-wrap gap-2">
            <AssignMemberForm
              projectId={id}
              candidates={staffCandidates.map((c) => ({
                user_id: c.user_id,
                full_name: c.full_name,
                email: c.email,
              }))}
              projectRole="member"
              buttonLabel="Add staff"
            />
            <AssignMemberForm
              projectId={id}
              candidates={clientCandidates.map((c) => ({
                user_id: c.user_id,
                full_name: c.full_name,
                email: c.email,
              }))}
              projectRole="viewer"
              buttonLabel="Add existing viewer"
            />
            <InviteClientViewerForm projectId={id} />
          </div>
        }
      >
        {members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team members yet"
            description="Add staff or invite a client viewer to give them access."
          />
        ) : (
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
              {members.map((m) => {
                async function remove() {
                  "use server";
                  await removeProjectMember(id, m.id);
                }
                return (
                  <TableRow key={m.id} style={{ height: "var(--admin-row-h)" }}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          email={m.profile?.email ?? ""}
                          name={m.profile?.full_name ?? "?"}
                          size="sm"
                        />
                        <span className="font-medium">{m.profile?.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{m.profile?.email}</TableCell>
                    <TableCell>
                      <StatusPill
                        status={
                          (m.profile?.role ?? "client") as
                            | "admin"
                            | "staff"
                            | "client"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <StatusPill status={m.project_role} />
                    </TableCell>
                    <TableCell className="text-right">
                      <form action={remove}>
                        <Button type="submit" variant="ghost" size="sm">
                          Remove
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```powershell
npm run build
```

- [ ] **Step 3: Commit**

```powershell
git add src/app/admin/projects/[id]/team/page.tsx
git commit -m "feat(admin): refactor project team page with avatars and unified add controls"
```

---

## Task 11: Users pages refactor

**Files:**
- Modify: `src/app/admin/users/page.tsx`
- Modify: `src/app/admin/users/[id]/page.tsx`

- [ ] **Step 1: Replace `src/app/admin/users/page.tsx`**

```tsx
import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { ListSearch } from "@/components/admin/ui/list-search";
import { FilterChips } from "@/components/admin/ui/filter-chips";
import { EmptyState } from "@/components/empty-state";
import { listUsers } from "@/lib/admin/queries";
import { InviteUserForm } from "@/components/admin/forms/invite-user-form";
import { ArchiveToggle } from "@/components/admin/archive-toggle";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
  { value: "client", label: "Client" },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; q?: string; role?: string }>;
}) {
  const sp = await searchParams;
  const includeInactive = sp.archived === "1";
  const all = await listUsers({ includeInactive });
  const q = (sp.q ?? "").toLowerCase().trim();
  const roleFilter = sp.role ?? "";
  const rows = all.filter((u) => {
    if (q && !u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) {
      return false;
    }
    if (roleFilter && u.role !== roleFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Everyone with access to DC&A Hub PMS"
        action={<InviteUserForm />}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ListSearch placeholder="Search by name or email..." />
          <ArchiveToggle label="Show inactive" />
        </div>
        <FilterChips paramName="role" options={ROLE_OPTIONS} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q || roleFilter ? "No users match" : "No users yet"}
          description={
            q || roleFilter
              ? "Adjust your filters or search."
              : "Invite teammates and clients to get started."
          }
        />
      ) : (
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
            {rows.map((u) => (
              <TableRow
                key={u.id}
                className={!u.is_active ? "opacity-60" : ""}
                style={{ height: "var(--admin-row-h)" }}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <UserAvatar email={u.email} name={u.full_name} size="sm" />
                    <span className="font-medium">{u.full_name}</span>
                  </div>
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <StatusPill status={u.role as "admin" | "staff" | "client"} />
                </TableCell>
                <TableCell>
                  <StatusPill status={u.is_active ? "active-user" : "inactive-user"} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/admin/users/${u.id}`} />}
                  >
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/admin/users/[id]/page.tsx`**

```tsx
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
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
  async function deactivate() {
    "use server";
    await deactivateUser(id);
  }
  async function reactivate() {
    "use server";
    await reactivateUser(id);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <UserAvatar email={u.email} name={u.full_name} size="lg" />
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{u.full_name}</h1>
          <p className="text-sm text-muted-foreground">{u.email}</p>
          <div className="flex gap-2">
            <StatusPill status={u.role as "admin" | "staff" | "client"} />
            <StatusPill status={u.is_active ? "active-user" : "inactive-user"} />
          </div>
        </div>
      </div>

      <SectionCard
        title="Role"
        description="Determines which surfaces this user can access."
      >
        <form action={changeRole} className="flex items-end gap-2 max-w-sm">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Global role</label>
            <Select name="role" defaultValue={u.role}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Save
          </Button>
        </form>
      </SectionCard>

      <SectionCard
        title="Danger zone"
        description="Deactivating revokes the user's sessions and prevents future sign-ins."
        tone="destructive"
      >
        <form action={u.is_active ? deactivate : reactivate}>
          <Button type="submit" variant={u.is_active ? "destructive" : "default"}>
            {u.is_active ? "Deactivate user" : "Reactivate user"}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```powershell
npm run build
```

- [ ] **Step 4: Commit**

```powershell
git add src/app/admin/users
git commit -m "feat(admin): refactor users pages with avatars, filter chips, sectioned cards"
```

---

## Task 12: Quality pass — full run-through, light + dark, fix regressions

**Files:** any of the above, depending on what breaks.

This is verification-and-polish. No new components.

- [ ] **Step 1: Confirm full test suite passes**

```powershell
npm test
```

Expected: 44 tests pass (no test changes in 2.5).

- [ ] **Step 2: Confirm clean build**

```powershell
npm run build
```

Expected: success, no warnings about missing modules.

- [ ] **Step 3: Run dev server and walk every page in light mode**

```powershell
npm run dev
```

In a browser at `http://localhost:3000`:

1. Log in as admin
2. `/admin` — verify hero strip, 4 stat cards, 2-column body
3. `/admin/clients` — table renders, search works, archive toggle works, empty state shows when search has no matches
4. `/admin/clients/new` — sectioned form, sticky save bar appears when typing
5. `/admin/clients/[id]` — three sections (Basics, Danger zone), archive flow works
6. `/admin/projects` — same checks plus filter chips for status
7. `/admin/projects/new` and `[id]` — three sections (Basics, Schedule, Description), sticky save bar
8. `/admin/projects/[id]/team` — header has three add buttons, members table with avatars
9. `/admin/users` — search, role filter chips, avatars in rows
10. `/admin/users/[id]` — large avatar header, two sections
11. Sidebar collapse/expand works and persists across page reloads
12. User dropdown opens, sign-out works (re-log in afterward)

- [ ] **Step 4: Switch to dark mode via the topbar toggle and walk the same flow**

For every page above:
- Confirm text is readable
- Confirm status pills have appropriate contrast
- Confirm sticky form bar's blur background works
- Fix any token usage that breaks (likely candidates: status pill border colors, card shadows on dark)

- [ ] **Step 5: Fix any regressions found**

For each issue:
1. Make the fix in the relevant file
2. Verify with `npm run build` (or check the page in dev)
3. Commit with a focused message: `fix(admin): <what was broken>`

- [ ] **Step 6: Tablet-width sanity check**

In browser devtools, set viewport to 1000px wide:
- Sidebar should still be visible (collapsed or expanded — user choice persists)
- Tables should not break layout (horizontal scroll if needed)
- Overview's two-column body should stack into one column at < 1024px

If the dashboard doesn't stack correctly, verify `lg:col-span-2` and `lg:grid-cols-3` on the overview page; the responsive prefixes should already handle it.

- [ ] **Step 7: Final commit (if cleanup remained)**

If steps 5/6 produced fixes that aren't yet committed, commit them. Otherwise no commit is needed — just mark this task done.

---

## Verification (end of plan)

After all tasks:

1. `npm run build` succeeds.
2. `npm test` passes (44 tests, unchanged from Plan 2).
3. Every admin page renders cleanly in both light and dark.
4. Sidebar collapses, persists, shows count badges.
5. Topbar shows breadcrumbs, theme toggle, and a working user dropdown with sign out.
6. List pages have search, filter chips (where applicable), empty states with icon + CTA.
7. Edit/new pages use sectioned forms with a sticky save bar that appears on dirty.
8. The Plan 2 manual smoke flow (admin invites → creates client + project → assigns → role-gated logins) still works end-to-end with the new UI.

After this plan ships, the admin console feels like a finished product. Next: **Plan 3 — Workspace + Activity Flow** (phases, activities, proof uploads inside `/workspace/projects/[id]`).

---

## Self-Review Notes

- **Spec coverage:**
  - §3 (locked decisions) — tokens (Task 1), components (Tasks 2-4), sidebar (Task 6), forms (Tasks 8, 9)
  - §4 (tokens) — Task 1
  - §5 (primitives) — Tasks 2, 3, 4 cover all 8 listed primitives plus EmptyState extension
  - §6 (AdminShell) — Task 6
  - §7 (page-by-page) — Tasks 7-11 cover overview + clients + projects + team + users
  - §8 (theme) — Task 1 tokens + Task 3 ThemeToggle + Task 12 dark walk
  - §9 (motion) — `tw-animate-css` already imported; Task 6's `<main>` adds fade-in; toasts use sonner defaults
  - §10 (tablet) — Task 6 sidebar widths + Task 12 step 6 verification
  - §11 (implementation order) — matches Tasks 1-12
  - §12 (testing) — Task 12 quality pass; no new automated tests, matches spec
- **Type/name consistency:** `AdminCounts` defined in Task 5 (`queries.ts`), used by Tasks 6 (sidebar/shell) and 7 (overview). `StatusPill` accepts the union defined in Task 2 step 3, used everywhere. `EmptyState` props (`icon`, `title`, `description`, `action`) match the Task 4 step 6 signature.
- **Placeholder check:** No "TBD"/"TODO"/"similar to Task N". Each task includes complete code for every file it touches.
- **Known runtime considerations:**
  - The `dropdown-menu.tsx` `render` prop fallback note (Task 3 step 3) is pragmatic — the engineer should check the existing component before assuming `render` works.
  - `EmptyState` has existing callers; Task 4 step 6 includes the grep step to find them.
