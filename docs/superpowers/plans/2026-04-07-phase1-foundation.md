# Phase 1: Foundation — Scaffolding, Auth, Layout & RBAC

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Next.js project with Supabase auth (sign-up, pending approval, login), the sidebar/topbar layout shell, and a working role-based access control system via Settings.

**Architecture:** Next.js 14 App Router with server components where possible, client components for interactive UI. Supabase handles auth and Postgres with RLS. shadcn/ui for components, Tailwind for styling with SRSF brand colors (green/purple). Middleware protects routes based on user role and approval status.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Auth + PostgreSQL + RLS), Lucide icons

**Project directory:** `C:\Users\ishma\Desktop\springboard-mis`

---

## File Structure

```
springboard-mis/
├── .env.local                          # Supabase URL + anon key
├── .env.example                        # Template for env vars
├── next.config.js                      # Next.js config
├── tailwind.config.ts                  # Tailwind with SRSF brand colors
├── tsconfig.json                       # TypeScript config
├── package.json
├── postcss.config.js
├── components.json                     # shadcn/ui config
├── supabase/
│   └── migrations/
│       └── 001_foundation.sql          # Users, roles, permissions, audit_log tables + RLS + seed data
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout — loads fonts, providers
│   │   ├── page.tsx                    # Redirects to /dashboard
│   │   ├── globals.css                 # Tailwind imports + SRSF CSS variables
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx            # Login page
│   │   │   ├── signup/
│   │   │   │   └── page.tsx            # Sign-up page
│   │   │   ├── pending/
│   │   │   │   └── page.tsx            # Pending approval screen
│   │   │   └── layout.tsx              # Auth pages layout (centered, no sidebar)
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx              # Dashboard layout — sidebar + topbar + main area
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx            # Executive dashboard placeholder
│   │   │   ├── programs/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx        # Program dashboard placeholder
│   │   │   ├── data-entry/
│   │   │   │   └── page.tsx            # Data entry placeholder
│   │   │   ├── indicators/
│   │   │   │   └── page.tsx            # Indicators management placeholder
│   │   │   ├── learnings/
│   │   │   │   └── page.tsx            # Learnings placeholder
│   │   │   └── settings/
│   │   │       └── page.tsx            # Settings — user management + roles/permissions
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts            # Supabase auth callback handler
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx             # Collapsible sidebar with nav items
│   │   │   ├── topbar.tsx              # Top bar — logo, title, user menu
│   │   │   └── sidebar-nav-item.tsx    # Individual nav item with submenu support
│   │   ├── settings/
│   │   │   ├── pending-users-table.tsx # Pending users with approve/reject
│   │   │   ├── active-users-table.tsx  # Active users with role editing
│   │   │   ├── invite-user-modal.tsx   # Invite user modal form
│   │   │   └── roles-permissions.tsx   # Permission matrix grid
│   │   └── ui/                         # shadcn/ui components (installed via CLI)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # Browser Supabase client
│   │   │   ├── server.ts               # Server Supabase client (cookies-based)
│   │   │   └── admin.ts                # Service-role client for admin ops
│   │   ├── constants.ts                # Module names, role names, program slugs
│   │   └── types.ts                    # TypeScript types for users, roles, permissions
│   ├── hooks/
│   │   └── use-user.ts                 # Client hook for current user + role + permissions
│   └── middleware.ts                   # Route protection — redirect based on auth/role/approval status
```

---

## Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `next.config.js`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Create Next.js project**

Run from `C:\Users\ishma\Desktop\springboard-mis`:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```
Expected: Project scaffolded with `src/app/` structure, Tailwind configured.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr lucide-react recharts xlsx
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```
Select: New York style, Zinc base color, CSS variables = yes.

Then install needed components:
```bash
npx shadcn@latest add button card input label table dialog badge tabs dropdown-menu avatar separator sheet toast select checkbox switch textarea
```

- [ ] **Step 4: Configure SRSF brand colors in Tailwind**

Replace `tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        srsf: {
          green: {
            50: "#f0fbe8",
            100: "#ddf5cc",
            200: "#bbeb99",
            300: "#8fdb5c",
            400: "#6bcc33",
            500: "#5BBF3A",
            600: "#3d9922",
            700: "#2f7319",
            800: "#285c18",
            900: "#244d19",
            950: "#0f2b08",
          },
          purple: {
            50: "#f5f1f9",
            100: "#ebe4f3",
            200: "#d4c5e5",
            300: "#b89cd3",
            400: "#9a6fbd",
            500: "#7f4fa6",
            600: "#6B2D7B",
            700: "#5a2b72",
            800: "#4b265e",
            900: "#3f224e",
            950: "#250e32",
          },
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

- [ ] **Step 5: Update CSS variables for SRSF branding**

Replace `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 97%;
    --foreground: 260 20% 16%;
    --card: 0 0% 100%;
    --card-foreground: 260 20% 16%;
    --popover: 0 0% 100%;
    --popover-foreground: 260 20% 16%;
    --primary: 104 53% 49%;
    --primary-foreground: 0 0% 100%;
    --secondary: 284 46% 33%;
    --secondary-foreground: 0 0% 100%;
    --muted: 260 10% 93%;
    --muted-foreground: 260 10% 45%;
    --accent: 104 53% 93%;
    --accent-foreground: 104 53% 25%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 260 10% 88%;
    --input: 260 10% 88%;
    --ring: 104 53% 49%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 6: Create environment files**

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Create `.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Create `.gitignore` (add to existing):
```
.env.local
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```
Expected: Server starts on `http://localhost:3000`, default Next.js page renders.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js project with SRSF branding and shadcn/ui"
```

---

## Task 2: Supabase Client Setup

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`

- [ ] **Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client**

Create `src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — can't set cookies
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create admin client**

Create `src/lib/supabase/admin.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase client helpers (browser, server, admin)"
```

---

## Task 3: Database Schema — Foundation Tables

**Files:**
- Create: `supabase/migrations/001_foundation.sql`, `src/lib/types.ts`, `src/lib/constants.ts`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/001_foundation.sql`:
```sql
-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- ROLES TABLE
-- ============================================
create table public.roles (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

-- Seed default roles
insert into public.roles (name, is_system) values
  ('Admin', true),
  ('Program Manager', true),
  ('Data Entry Officer', true),
  ('Viewer', true);

-- ============================================
-- MODULES ENUM
-- ============================================
create type public.app_module as enum (
  'executive_dashboard',
  'program_dashboards',
  'data_entry',
  'indicators',
  'learnings',
  'settings'
);

-- ============================================
-- ROLE PERMISSIONS TABLE
-- ============================================
create table public.role_permissions (
  id uuid primary key default uuid_generate_v4(),
  role_id uuid not null references public.roles(id) on delete cascade,
  module public.app_module not null,
  allowed boolean not null default false,
  unique (role_id, module)
);

-- Seed default permissions
-- Admin: all modules
insert into public.role_permissions (role_id, module, allowed)
select r.id, m.module, true
from public.roles r,
     unnest(enum_range(null::public.app_module)) as m(module)
where r.name = 'Admin';

-- Program Manager: executive_dashboard, program_dashboards, learnings
insert into public.role_permissions (role_id, module, allowed)
select r.id, m.module,
  case when m.module in ('executive_dashboard', 'program_dashboards', 'learnings') then true else false end
from public.roles r,
     unnest(enum_range(null::public.app_module)) as m(module)
where r.name = 'Program Manager';

-- Data Entry Officer: data_entry only
insert into public.role_permissions (role_id, module, allowed)
select r.id, m.module,
  case when m.module = 'data_entry' then true else false end
from public.roles r,
     unnest(enum_range(null::public.app_module)) as m(module)
where r.name = 'Data Entry Officer';

-- Viewer: executive_dashboard, program_dashboards, learnings
insert into public.role_permissions (role_id, module, allowed)
select r.id, m.module,
  case when m.module in ('executive_dashboard', 'program_dashboards', 'learnings') then true else false end
from public.roles r,
     unnest(enum_range(null::public.app_module)) as m(module)
where r.name = 'Viewer';

-- ============================================
-- USER PROFILES TABLE
-- ============================================
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role_id uuid references public.roles(id),
  status text not null default 'pending' check (status in ('pending', 'active', 'inactive', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- AUDIT LOG TABLE
-- ============================================
create table public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  action text not null,
  details jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ============================================
-- PROGRAMS TABLE
-- ============================================
create table public.programs (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  description text default '',
  created_at timestamptz not null default now()
);

-- Seed programs
insert into public.programs (name, slug, description) values
  ('Enterprise Spotlight', 'enterprise-spotlight', 'Enterprise development program tracking applications and business metrics'),
  ('Virtual University', 'virtual-university', 'Weekly educational episodes aired on Facebook and YouTube'),
  ('Hangout', 'hangout', 'Weekly community engagement episodes on social media platforms'),
  ('ABSA Onboarding', 'absa-onboarding', 'Participant onboarding program with ABSA partnership');

-- ============================================
-- AUTO-CREATE PROFILE ON SIGN-UP (trigger)
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, full_name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'pending'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- User profiles: users can read their own, admins can read/write all
alter table public.user_profiles enable row level security;

create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.user_profiles for select
  using (
    exists (
      select 1 from public.user_profiles up
      join public.roles r on up.role_id = r.id
      where up.id = auth.uid() and r.name = 'Admin'
    )
  );

create policy "Admins can update all profiles"
  on public.user_profiles for update
  using (
    exists (
      select 1 from public.user_profiles up
      join public.roles r on up.role_id = r.id
      where up.id = auth.uid() and r.name = 'Admin'
    )
  );

-- Roles: readable by all authenticated users
alter table public.roles enable row level security;

create policy "Authenticated users can view roles"
  on public.roles for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage roles"
  on public.roles for all
  using (
    exists (
      select 1 from public.user_profiles up
      join public.roles r on up.role_id = r.id
      where up.id = auth.uid() and r.name = 'Admin'
    )
  );

-- Role permissions: readable by all authenticated, writable by admins
alter table public.role_permissions enable row level security;

create policy "Authenticated users can view permissions"
  on public.role_permissions for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage permissions"
  on public.role_permissions for all
  using (
    exists (
      select 1 from public.user_profiles up
      join public.roles r on up.role_id = r.id
      where up.id = auth.uid() and r.name = 'Admin'
    )
  );

-- Programs: readable by all authenticated
alter table public.programs enable row level security;

create policy "Authenticated users can view programs"
  on public.programs for select
  using (auth.role() = 'authenticated');

-- Audit log: admins only
alter table public.audit_log enable row level security;

create policy "Admins can view audit log"
  on public.audit_log for select
  using (
    exists (
      select 1 from public.user_profiles up
      join public.roles r on up.role_id = r.id
      where up.id = auth.uid() and r.name = 'Admin'
    )
  );

create policy "Authenticated users can insert audit log"
  on public.audit_log for insert
  with check (auth.role() = 'authenticated');
```

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase dashboard → SQL Editor → paste and run the migration SQL.
Expected: All tables created, seed data inserted, RLS policies active.

- [ ] **Step 3: Create TypeScript types**

Create `src/lib/types.ts`:
```typescript
export type UserStatus = "pending" | "active" | "inactive" | "rejected";

export type AppModule =
  | "executive_dashboard"
  | "program_dashboards"
  | "data_entry"
  | "indicators"
  | "learnings"
  | "settings";

export interface Role {
  id: string;
  name: string;
  is_system: boolean;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  module: AppModule;
  allowed: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role_id: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  role?: Role;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Program {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_at: string;
}
```

- [ ] **Step 4: Create constants**

Create `src/lib/constants.ts`:
```typescript
import { AppModule } from "./types";
import {
  LayoutDashboard,
  BarChart3,
  ClipboardEdit,
  SlidersHorizontal,
  Lightbulb,
  Settings,
  LucideIcon,
} from "lucide-react";

export const PROGRAMS = [
  { name: "Enterprise Spotlight", slug: "enterprise-spotlight" },
  { name: "Virtual University", slug: "virtual-university" },
  { name: "Hangout", slug: "hangout" },
  { name: "ABSA Onboarding", slug: "absa-onboarding" },
] as const;

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  module: AppModule;
  children?: { label: string; href: string }[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Executive Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    module: "executive_dashboard",
  },
  {
    label: "Program Dashboards",
    href: "/programs",
    icon: BarChart3,
    module: "program_dashboards",
    children: PROGRAMS.map((p) => ({
      label: p.name,
      href: `/programs/${p.slug}`,
    })),
  },
  {
    label: "Data Entry",
    href: "/data-entry",
    icon: ClipboardEdit,
    module: "data_entry",
  },
  {
    label: "Indicators",
    href: "/indicators",
    icon: SlidersHorizontal,
    module: "indicators",
  },
  {
    label: "Learnings",
    href: "/learnings",
    icon: Lightbulb,
    module: "learnings",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    module: "settings",
  },
];

export const MODULE_LABELS: Record<AppModule, string> = {
  executive_dashboard: "Executive Dashboard",
  program_dashboards: "Program Dashboards",
  data_entry: "Data Entry",
  indicators: "Indicators Management",
  learnings: "Learnings",
  settings: "Settings",
};
```

- [ ] **Step 5: Commit**

```bash
git add supabase/ src/lib/types.ts src/lib/constants.ts
git commit -m "feat: add foundation database schema, types, and navigation constants"
```

---

## Task 4: Auth Callback Route

**Files:**
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Create auth callback handler**

Create `src/app/auth/callback/route.ts`:
```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check user approval status
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("status")
          .eq("id", user.id)
          .single();

        if (profile?.status === "pending" || profile?.status === "rejected") {
          return NextResponse.redirect(`${origin}/pending`);
        }

        if (profile?.status === "inactive") {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=inactive`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/auth/
git commit -m "feat: add Supabase auth callback with approval status check"
```

---

## Task 5: Auth Pages (Login, Sign-up, Pending)

**Files:**
- Create: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/pending/page.tsx`

- [ ] **Step 1: Create auth layout**

Create `src/app/(auth)/layout.tsx`:
```typescript
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-srsf-purple-950">
      <div className="w-full max-w-md p-8">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create login page**

Create `src/app/(auth)/login/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const errorParam = searchParams.get("error");
  const errorMessages: Record<string, string> = {
    inactive: "Your account has been deactivated. Contact an administrator.",
    auth: "Authentication failed. Please try again.",
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Check approval status
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("status")
        .eq("id", user.id)
        .single();

      if (profile?.status === "pending" || profile?.status === "rejected") {
        router.push("/pending");
        return;
      }

      if (profile?.status === "inactive") {
        await supabase.auth.signOut();
        setError("Your account has been deactivated. Contact an administrator.");
        setLoading(false);
        return;
      }
    }

    router.push("/dashboard");
  }

  return (
    <Card className="border-0 shadow-2xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 text-4xl font-bold text-srsf-green-500">
          SRSF
        </div>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>
          Sign in to the Management Information System
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          {(error || errorParam) && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error || errorMessages[errorParam!] || "An error occurred."}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full bg-srsf-green-500 hover:bg-srsf-green-600"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-srsf-purple-600 hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
```

- [ ] **Step 3: Create sign-up page**

Create `src/app/(auth)/signup/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/pending");
  }

  return (
    <Card className="border-0 shadow-2xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 text-4xl font-bold text-srsf-green-500">
          SRSF
        </div>
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>
          Sign up to request access to the MIS
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSignUp}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full bg-srsf-green-500 hover:bg-srsf-green-600"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Sign up"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-srsf-purple-600 hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
```

- [ ] **Step 4: Create pending approval page**

Create `src/app/(auth)/pending/page.tsx`:
```typescript
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function PendingPage() {
  return (
    <Card className="border-0 shadow-2xl text-center">
      <CardHeader>
        <div className="mx-auto mb-4 text-4xl font-bold text-srsf-green-500">
          SRSF
        </div>
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-srsf-purple-100 flex items-center justify-center">
          <Clock className="w-8 h-8 text-srsf-purple-600" />
        </div>
        <CardTitle className="text-xl">Account Pending Approval</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Your account is awaiting administrator approval. You&apos;ll receive
          an email once access has been granted.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          If you believe this is an error, please contact your system
          administrator.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Verify all three pages render**

Start dev server and visit:
- `http://localhost:3000/login` — should show login card
- `http://localhost:3000/signup` — should show sign-up card
- `http://localhost:3000/pending` — should show pending approval card

- [ ] **Step 6: Commit**

```bash
git add src/app/\(auth\)/
git commit -m "feat: add login, sign-up, and pending approval pages"
```

---

## Task 6: Middleware — Route Protection

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware**

Create `src/middleware.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = ["/login", "/signup", "/pending", "/auth/callback"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated — redirect to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Check user profile status
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("status, role_id")
    .eq("id", user.id)
    .single();

  // Pending or rejected — redirect to pending page
  if (!profile || profile.status === "pending" || profile.status === "rejected") {
    const url = request.nextUrl.clone();
    url.pathname = "/pending";
    return NextResponse.redirect(url);
  }

  // Inactive — sign out and redirect to login
  if (profile.status === "inactive") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "inactive");
    return NextResponse.redirect(url);
  }

  // No role assigned yet — redirect to pending
  if (!profile.role_id) {
    const url = request.nextUrl.clone();
    url.pathname = "/pending";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Verify middleware redirects**

- Visit `http://localhost:3000/dashboard` while logged out → should redirect to `/login`
- Visit `http://localhost:3000/login` → should render login page (no redirect loop)

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add route protection middleware with approval status checks"
```

---

## Task 7: User Hook

**Files:**
- Create: `src/hooks/use-user.ts`

- [ ] **Step 1: Create useUser hook**

Create `src/hooks/use-user.ts`:
```typescript
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile, RolePermission, AppModule } from "@/lib/types";

interface UseUserReturn {
  user: UserProfile | null;
  permissions: RolePermission[];
  loading: boolean;
  hasAccess: (module: AppModule) => boolean;
  signOut: () => Promise<void>;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*, role:roles(*)")
        .eq("id", authUser.id)
        .single();

      if (profile) {
        setUser(profile as UserProfile);

        if (profile.role_id) {
          const { data: perms } = await supabase
            .from("role_permissions")
            .select("*")
            .eq("role_id", profile.role_id);

          setPermissions((perms as RolePermission[]) || []);
        }
      }

      setLoading(false);
    }

    loadUser();
  }, []);

  function hasAccess(module: AppModule): boolean {
    return permissions.some((p) => p.module === module && p.allowed);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return { user, permissions, loading, hasAccess, signOut };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-user.ts
git commit -m "feat: add useUser hook with role-based permission checking"
```

---

## Task 8: Dashboard Layout Shell (Sidebar + Topbar)

**Files:**
- Create: `src/components/layout/sidebar.tsx`, `src/components/layout/topbar.tsx`, `src/components/layout/sidebar-nav-item.tsx`, `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create sidebar nav item component**

Create `src/components/layout/sidebar-nav-item.tsx`:
```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/constants";

interface SidebarNavItemProps {
  item: NavItem;
}

export function SidebarNavItem({ item }: SidebarNavItemProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(
    item.children?.some((child) => pathname.startsWith(child.href)) ?? false
  );

  const isActive =
    pathname === item.href ||
    item.children?.some((child) => pathname === child.href);

  const Icon = item.icon;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            isActive
              ? "bg-srsf-green-500/20 text-srsf-green-300"
              : "text-white/70 hover:text-white hover:bg-white/10"
          )}
        >
          <Icon className="w-5 h-5 shrink-0" />
          <span className="flex-1 text-left">{ item.label }</span>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
        {expanded && (
          <div className="ml-8 mt-1 space-y-1">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "block px-3 py-1.5 rounded-md text-sm transition-colors",
                  pathname === child.href
                    ? "bg-srsf-green-500/20 text-srsf-green-300"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        isActive
          ? "bg-srsf-green-500/20 text-srsf-green-300"
          : "text-white/70 hover:text-white hover:bg-white/10"
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}
```

- [ ] **Step 2: Create sidebar component**

Create `src/components/layout/sidebar.tsx`:
```typescript
"use client";

import { NAV_ITEMS } from "@/lib/constants";
import { SidebarNavItem } from "./sidebar-nav-item";
import { useUser } from "@/hooks/use-user";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { hasAccess, loading } = useUser();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => loading || hasAccess(item.module)
  );

  return (
    <>
      {/* Mobile overlay */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-srsf-purple-700 transition-all duration-300 flex flex-col",
          collapsed ? "w-0 overflow-hidden lg:w-16" : "w-64"
        )}
      >
        {/* Logo area */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-white/10">
          {!collapsed && (
            <span className="text-xl font-bold text-white">SRSF MIS</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-white/70 hover:text-white hidden lg:block"
          >
            {collapsed ? (
              <PanelLeft className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        {!collapsed && (
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {visibleItems.map((item) => (
              <SidebarNavItem key={item.href} item={item} />
            ))}
          </nav>
        )}

        {/* Bottom branding */}
        {!collapsed && (
          <div className="px-4 py-3 border-t border-white/10">
            <p className="text-xs text-white/40">
              Springboard Road Show Foundation
            </p>
          </div>
        )}
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "fixed top-4 left-4 z-50 p-2 rounded-md bg-srsf-purple-700 text-white lg:hidden",
          !collapsed && "hidden"
        )}
      >
        <PanelLeft className="w-5 h-5" />
      </button>
    </>
  );
}
```

- [ ] **Step 3: Create topbar component**

Create `src/components/layout/topbar.tsx`:
```typescript
"use client";

import { useUser } from "@/hooks/use-user";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";

export function Topbar() {
  const { user, signOut } = useUser();

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        {user?.role && (
          <Badge variant="secondary" className="bg-srsf-purple-100 text-srsf-purple-700">
            {user.role.name}
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:opacity-80">
              <Avatar className="w-8 h-8 bg-srsf-green-500">
                <AvatarFallback className="bg-srsf-green-500 text-white text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline">
                {user?.full_name || user?.email}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2">
              <User className="w-4 h-4" />
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut} className="gap-2 text-red-600">
              <LogOut className="w-4 h-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create dashboard layout**

Create `src/app/(dashboard)/layout.tsx`:
```typescript
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:ml-64 transition-all duration-300">
        <Topbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/ src/app/\(dashboard\)/layout.tsx
git commit -m "feat: add sidebar, topbar, and dashboard layout shell"
```

---

## Task 9: Placeholder Pages for All Modules

**Files:**
- Create: `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/programs/[slug]/page.tsx`, `src/app/(dashboard)/data-entry/page.tsx`, `src/app/(dashboard)/indicators/page.tsx`, `src/app/(dashboard)/learnings/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create root redirect**

Replace `src/app/page.tsx`:
```typescript
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 2: Create executive dashboard placeholder**

Create `src/app/(dashboard)/dashboard/page.tsx`:
```typescript
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Executive Dashboard</h1>
      <p className="text-muted-foreground mt-2">
        Overview of all programs coming in Phase 4.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create program dashboard placeholder**

Create `src/app/(dashboard)/programs/[slug]/page.tsx`:
```typescript
import { PROGRAMS } from "@/lib/constants";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProgramPage({ params }: Props) {
  const { slug } = await params;
  const program = PROGRAMS.find((p) => p.slug === slug);

  if (!program) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">{program.name}</h1>
      <p className="text-muted-foreground mt-2">
        Program dashboard coming in Phase 3.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Create data entry placeholder**

Create `src/app/(dashboard)/data-entry/page.tsx`:
```typescript
export default function DataEntryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Data Entry</h1>
      <p className="text-muted-foreground mt-2">
        Data entry forms coming in Phase 2.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Create indicators placeholder**

Create `src/app/(dashboard)/indicators/page.tsx`:
```typescript
export default function IndicatorsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Indicators Management</h1>
      <p className="text-muted-foreground mt-2">
        Indicator configuration coming in Phase 5.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Create learnings placeholder**

Create `src/app/(dashboard)/learnings/page.tsx`:
```typescript
export default function LearningsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Learnings</h1>
      <p className="text-muted-foreground mt-2">
        Learnings dashboard coming in Phase 6.
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Verify navigation works**

Start dev server. After logging in as an approved admin user:
- Sidebar links should navigate to each placeholder page
- Program submenu should expand and link to individual program pages
- Unknown slugs (e.g., `/programs/unknown`) should show 404

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx src/app/\(dashboard\)/
git commit -m "feat: add placeholder pages for all modules with root redirect"
```

---

## Task 10: Settings Page — User Management

**Files:**
- Create: `src/app/(dashboard)/settings/page.tsx`, `src/components/settings/pending-users-table.tsx`, `src/components/settings/active-users-table.tsx`, `src/components/settings/invite-user-modal.tsx`

- [ ] **Step 1: Create pending users table**

Create `src/components/settings/pending-users-table.tsx`:
```typescript
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import type { UserProfile, Role } from "@/lib/types";

interface PendingUsersTableProps {
  onUserUpdated: () => void;
}

export function PendingUsersTable({ onUserUpdated }: PendingUsersTableProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();

    const [usersRes, rolesRes] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("name"),
    ]);

    setUsers((usersRes.data as UserProfile[]) || []);
    setRoles((rolesRes.data as Role[]) || []);
    setLoading(false);
  }

  async function approveUser(userId: string) {
    const roleId = selectedRoles[userId];
    if (!roleId) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("user_profiles")
      .update({ status: "active", role_id: roleId, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (!error) {
      await supabase.from("audit_log").insert({
        user_id: userId,
        action: "user_approved",
        details: { role_id: roleId },
      });
      setUsers(users.filter((u) => u.id !== userId));
      onUserUpdated();
    }
  }

  async function rejectUser(userId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("user_profiles")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (!error) {
      await supabase.from("audit_log").insert({
        user_id: userId,
        action: "user_rejected",
        details: {},
      });
      setUsers(users.filter((u) => u.id !== userId));
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (users.length === 0)
    return <p className="text-sm text-muted-foreground">No pending users.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Signed Up</TableHead>
          <TableHead>Assign Role</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">
              {user.full_name || "—"}
            </TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              {new Date(user.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <Select
                onValueChange={(value) =>
                  setSelectedRoles({ ...selectedRoles, [user.id]: value })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => approveUser(user.id)}
                  disabled={!selectedRoles[user.id]}
                  className="bg-srsf-green-500 hover:bg-srsf-green-600"
                >
                  <Check className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => rejectUser(user.id)}
                >
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Create active users table**

Create `src/components/settings/active-users-table.tsx`:
```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserX, UserCheck } from "lucide-react";
import type { UserProfile, Role } from "@/lib/types";

interface ActiveUsersTableProps {
  refreshKey: number;
}

export function ActiveUsersTable({ refreshKey }: ActiveUsersTableProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const [usersRes, rolesRes] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("*, role:roles(*)")
        .in("status", ["active", "inactive"])
        .order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("name"),
    ]);

    setUsers((usersRes.data as UserProfile[]) || []);
    setRoles((rolesRes.data as Role[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  async function updateRole(userId: string, roleId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("user_profiles")
      .update({ role_id: roleId, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (!error) {
      await supabase.from("audit_log").insert({
        user_id: userId,
        action: "role_changed",
        details: { new_role_id: roleId },
      });
      loadData();
    }
  }

  async function toggleStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    const supabase = createClient();
    const { error } = await supabase
      .from("user_profiles")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (!error) {
      await supabase.from("audit_log").insert({
        user_id: userId,
        action: newStatus === "active" ? "user_reactivated" : "user_deactivated",
        details: {},
      });
      loadData();
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">
              {user.full_name || "—"}
            </TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <Select
                defaultValue={user.role_id || undefined}
                onValueChange={(value) => updateRole(user.id, value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Badge
                variant={user.status === "active" ? "default" : "secondary"}
                className={
                  user.status === "active"
                    ? "bg-srsf-green-100 text-srsf-green-700"
                    : ""
                }
              >
                {user.status}
              </Badge>
            </TableCell>
            <TableCell>
              {new Date(user.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleStatus(user.id, user.status)}
              >
                {user.status === "active" ? (
                  <>
                    <UserX className="w-4 h-4 mr-1" /> Deactivate
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 mr-1" /> Reactivate
                  </>
                )}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Create invite user modal**

Create `src/components/settings/invite-user-modal.tsx`:
```typescript
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";
import type { Role } from "@/lib/types";

interface InviteUserModalProps {
  onInvited: () => void;
}

export function InviteUserModal({ onInvited }: InviteUserModalProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRoles() {
      const supabase = createClient();
      const { data } = await supabase.from("roles").select("*").order("name");
      setRoles((data as Role[]) || []);
    }
    if (open) loadRoles();
  }, [open]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, roleId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to invite user");
      }

      setOpen(false);
      setEmail("");
      setRoleId("");
      onInvited();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-srsf-green-500 hover:bg-srsf-green-600">
          <UserPlus className="w-4 h-4 mr-2" /> Invite User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a New User</DialogTitle>
          <DialogDescription>
            Send an email invitation with a pre-assigned role.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleInvite}>
          <div className="space-y-4 py-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select onValueChange={setRoleId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !roleId}>
              {loading ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create invite user API route**

Create `src/app/api/invite-user/route.ts`:
```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Verify caller is admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*, role:roles(*)")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role?.name !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, roleId } = await request.json();

  if (!email || !roleId) {
    return NextResponse.json(
      { error: "Email and role are required" },
      { status: 400 }
    );
  }

  // Use admin client to create user
  const admin = createAdminClient();
  const { data: invitedUser, error } = await admin.auth.admin.inviteUserByEmail(
    email
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Set the user's role and status to active
  if (invitedUser.user) {
    await admin.from("user_profiles").upsert({
      id: invitedUser.user.id,
      email,
      role_id: roleId,
      status: "active",
      updated_at: new Date().toISOString(),
    });

    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "user_invited",
      details: { invited_email: email, role_id: roleId },
    });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Create settings page**

Create `src/app/(dashboard)/settings/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingUsersTable } from "@/components/settings/pending-users-table";
import { ActiveUsersTable } from "@/components/settings/active-users-table";
import { InviteUserModal } from "@/components/settings/invite-user-modal";

export default function SettingsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <InviteUserModal onInvited={handleRefresh} />
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pending Users</CardTitle>
            </CardHeader>
            <CardContent>
              <PendingUsersTable onUserUpdated={handleRefresh} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <ActiveUsersTable refreshKey={refreshKey} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Roles & Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Permission matrix — implemented in next step.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 6: Verify settings page**

- Navigate to `/settings`
- Should see Pending Users and Active Users tabs
- Invite User button should open modal

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/settings/ src/components/settings/ src/app/api/
git commit -m "feat: add settings page with user management (pending, active, invite)"
```

---

## Task 11: Settings Page — Roles & Permissions Matrix

**Files:**
- Create: `src/components/settings/roles-permissions.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Create roles permissions component**

Create `src/components/settings/roles-permissions.tsx`:
```typescript
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { MODULE_LABELS } from "@/lib/constants";
import type { Role, RolePermission, AppModule } from "@/lib/types";

const ALL_MODULES: AppModule[] = [
  "executive_dashboard",
  "program_dashboards",
  "data_entry",
  "indicators",
  "learnings",
  "settings",
];

export function RolesPermissions() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();

    const [rolesRes, permsRes] = await Promise.all([
      supabase.from("roles").select("*").order("name"),
      supabase.from("role_permissions").select("*"),
    ]);

    setRoles((rolesRes.data as Role[]) || []);
    setPermissions((permsRes.data as RolePermission[]) || []);
    setLoading(false);
  }

  function isAllowed(roleId: string, module: AppModule): boolean {
    return permissions.some(
      (p) => p.role_id === roleId && p.module === module && p.allowed
    );
  }

  async function togglePermission(roleId: string, module: AppModule) {
    const current = isAllowed(roleId, module);
    const supabase = createClient();

    const existing = permissions.find(
      (p) => p.role_id === roleId && p.module === module
    );

    if (existing) {
      await supabase
        .from("role_permissions")
        .update({ allowed: !current })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("role_permissions")
        .insert({ role_id: roleId, module, allowed: true });
    }

    await supabase.from("audit_log").insert({
      action: "permission_changed",
      details: { role_id: roleId, module, allowed: !current },
    });

    loadData();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-48">Module</TableHead>
          {roles.map((role) => (
            <TableHead key={role.id} className="text-center">
              {role.name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {ALL_MODULES.map((module) => (
          <TableRow key={module}>
            <TableCell className="font-medium">
              {MODULE_LABELS[module]}
            </TableCell>
            {roles.map((role) => (
              <TableCell key={role.id} className="text-center">
                <Checkbox
                  checked={isAllowed(role.id, module)}
                  onCheckedChange={() => togglePermission(role.id, module)}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Wire into settings page**

In `src/app/(dashboard)/settings/page.tsx`, replace the roles tab placeholder:

Change the import section to add:
```typescript
import { RolesPermissions } from "@/components/settings/roles-permissions";
```

Replace the TabsContent for "roles":
```typescript
        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Roles & Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <RolesPermissions />
            </CardContent>
          </Card>
        </TabsContent>
```

- [ ] **Step 3: Verify permissions matrix**

- Navigate to `/settings` → Roles & Permissions tab
- Should see a grid with modules as rows, roles as columns
- Checkboxes should toggle permissions

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/roles-permissions.tsx src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add roles and permissions matrix to settings"
```

---

## Task 12: First Admin Setup

Since this is a fresh system, the first user who signs up needs to be manually promoted to Admin in Supabase.

- [ ] **Step 1: Document the bootstrap process**

Create `docs/ADMIN_SETUP.md`:
```markdown
# First Admin Setup

After deploying the MIS and running the database migration:

1. Sign up at `/signup` with your admin email
2. Go to Supabase Dashboard → Table Editor → `user_profiles`
3. Find your row and update:
   - `status`: change from `pending` to `active`
   - `role_id`: set to the UUID of the "Admin" role (find it in the `roles` table)
4. Log out and log back in — you now have full admin access
5. All subsequent users can be managed from the Settings page

## Alternative: SQL

```sql
update public.user_profiles
set status = 'active',
    role_id = (select id from public.roles where name = 'Admin')
where email = 'your-admin@email.com';
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/ADMIN_SETUP.md
git commit -m "docs: add first admin bootstrap instructions"
```

---

## Summary

After completing all 12 tasks, Phase 1 delivers:

- Next.js 14 project with SRSF branding (green/purple)
- Supabase auth with sign-up → pending approval → admin grants access flow
- Collapsible sidebar + topbar layout
- Route protection via middleware (auth + approval + role checks)
- Settings page with user management (pending/active users, invite, role assignment)
- Roles & permissions matrix with checkbox toggles
- Placeholder pages for all 6 modules
- Foundation database schema with RLS policies

**Next phase:** Phase 2 — Database schema for program data + Data Entry forms.
