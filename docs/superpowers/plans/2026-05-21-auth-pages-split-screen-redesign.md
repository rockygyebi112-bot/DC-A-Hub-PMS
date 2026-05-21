# Auth Pages Split-Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the four auth screens a clean, corporate split-screen layout and consolidate duplicated markup into four reusable components.

**Architecture:** A split-screen `AuthLayout` (navy brand panel + form column) wraps four presentational components — `AuthBrandPanel`, `AuthCard`, `AuthField`, `AuthAlert`. The four `page.tsx` files keep only state and submit logic, composing the new components. Auth/Supabase logic is untouched.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, shadcn (base-nova), Vitest + jsdom, `@testing-library/react` (added in Task 1).

---

## File Structure

**Create:**
- `src/components/ui/auth-alert.tsx` — error/success banner
- `src/components/ui/auth-field.tsx` — label + input wrapper
- `src/components/ui/auth-card.tsx` — form-side card (title, description, body, footer)
- `src/components/ui/auth-brand-panel.tsx` — static navy brand panel
- `tests/ui/auth-alert.test.tsx`
- `tests/ui/auth-field.test.tsx`
- `tests/ui/auth-card.test.tsx`

**Modify:**
- `package.json` — add `@testing-library/react`, `@testing-library/dom` dev deps
- `tests/setup.ts` — register jsdom cleanup
- `src/app/(auth)/layout.tsx` — split-screen container
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/reset-password/page.tsx`
- `src/app/(auth)/accept-invite/page.tsx`

---

## Task 1: Add component-testing dependencies

**Files:**
- Modify: `package.json`
- Modify: `tests/setup.ts`

- [ ] **Step 1: Install testing-library**

Run: `npm install -D @testing-library/react@^16 @testing-library/dom@^10`
Expected: packages added to `devDependencies`, no peer-dep errors (React 19 is supported by testing-library 16).

- [ ] **Step 2: Add jsdom auto-cleanup to the test setup**

Edit `tests/setup.ts` — append after the existing `config(...)` call:

```ts
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount React trees between tests so component tests don't leak DOM.
afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: Verify the existing suite still passes**

Run: `npm test`
Expected: PASS — all existing tests green, no new failures.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tests/setup.ts
git commit -m "test: add @testing-library/react for component tests"
```

---

## Task 2: AuthAlert component

**Files:**
- Create: `src/components/ui/auth-alert.tsx`
- Test: `tests/ui/auth-alert.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/ui/auth-alert.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { AuthAlert } from '@/components/ui/auth-alert';

describe('AuthAlert', () => {
  it('renders error variant with role="alert"', () => {
    render(<AuthAlert variant="error">Something broke</AuthAlert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something broke');
  });

  it('renders success variant with role="status"', () => {
    render(<AuthAlert variant="success">All good</AuthAlert>);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('All good');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/auth-alert.test.tsx`
Expected: FAIL — cannot resolve `@/components/ui/auth-alert`.

- [ ] **Step 3: Write the implementation**

Create `src/components/ui/auth-alert.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface AuthAlertProps {
  variant: "error" | "success";
  children: React.ReactNode;
  className?: string;
}

/**
 * Inline banner for auth form errors and success messages.
 * Error uses role="alert" (assertive); success uses role="status" (polite).
 */
export function AuthAlert({ variant, children, className }: AuthAlertProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border p-3 text-sm break-words",
        variant === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
        className,
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/auth-alert.test.tsx`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/auth-alert.tsx tests/ui/auth-alert.test.tsx
git commit -m "feat: add AuthAlert component"
```

---

## Task 3: AuthField component

**Files:**
- Create: `src/components/ui/auth-field.tsx`
- Test: `tests/ui/auth-field.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/ui/auth-field.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { AuthField } from '@/components/ui/auth-field';

describe('AuthField', () => {
  it('associates the label with the input via htmlFor', () => {
    render(
      <AuthField label="Email" htmlFor="email">
        <input id="email" />
      </AuthField>,
    );
    // getByLabelText only succeeds when label/input are correctly associated.
    expect(screen.getByLabelText('Email')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/auth-field.test.tsx`
Expected: FAIL — cannot resolve `@/components/ui/auth-field`.

- [ ] **Step 3: Write the implementation**

Create `src/components/ui/auth-field.tsx`:

```tsx
import { Label } from "@/components/ui/label";

interface AuthFieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}

/**
 * Label + input pair for auth forms. Real-case label (not uppercase),
 * consistent spacing. The input element is passed as children and must
 * carry an `id` matching `htmlFor`.
 */
export function AuthField({ label, htmlFor, children }: AuthFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/auth-field.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/auth-field.tsx tests/ui/auth-field.test.tsx
git commit -m "feat: add AuthField component"
```

---

## Task 4: AuthCard component

**Files:**
- Create: `src/components/ui/auth-card.tsx`
- Test: `tests/ui/auth-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/ui/auth-card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { AuthCard } from '@/components/ui/auth-card';

describe('AuthCard', () => {
  it('renders the title as an h1', () => {
    render(
      <AuthCard title="Sign in">
        <p>body</p>
      </AuthCard>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sign in');
  });

  it('renders description, children and footer', () => {
    render(
      <AuthCard title="Sign in" description="Welcome back" footer={<a href="/x">link</a>}>
        <p>body content</p>
      </AuthCard>,
    );
    expect(screen.getByText('Welcome back')).toBeDefined();
    expect(screen.getByText('body content')).toBeDefined();
    expect(screen.getByRole('link', { name: 'link' })).toBeDefined();
  });

  it('omits the footer region when no footer is passed', () => {
    const { container } = render(
      <AuthCard title="Sign in"><p>body</p></AuthCard>,
    );
    expect(container.querySelector('[data-slot="auth-card-footer"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/auth-card.test.tsx`
Expected: FAIL — cannot resolve `@/components/ui/auth-card`.

- [ ] **Step 3: Write the implementation**

Create `src/components/ui/auth-card.tsx`:

```tsx
import Image from "next/image";

interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Form-side card for the auth pages. Flat surface (no gradient stripe, no
 * grain). Shows a small logo on mobile only — on lg+ the brand panel carries
 * the logo. Renders the title as the page's single h1.
 */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-sm">
      <Image
        src="/logo.png"
        alt="DC&A Hub"
        width={180}
        height={52}
        priority
        className="mb-8 h-12 w-auto lg:hidden"
      />
      <div className="mb-6 space-y-1.5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
      {footer && (
        <div
          data-slot="auth-card-footer"
          className="mt-6 border-t border-border pt-5 text-sm"
        >
          {footer}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/auth-card.test.tsx`
Expected: PASS — all three tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/auth-card.tsx tests/ui/auth-card.test.tsx
git commit -m "feat: add AuthCard component"
```

---

## Task 5: AuthBrandPanel component

**Files:**
- Create: `src/components/ui/auth-brand-panel.tsx`

No test: this component is static presentation with no behavior or props. It is verified by the build in Task 11.

- [ ] **Step 1: Write the implementation**

Create `src/components/ui/auth-brand-panel.tsx`:

```tsx
import Image from "next/image";

/**
 * Decorative brand panel shown on the left of the auth split-screen on lg+.
 * Solid navy, reversed-out logo, tagline, footer line. aria-hidden because
 * AuthCard duplicates the logo for non-decorative use.
 */
export function AuthBrandPanel() {
  return (
    <aside
      aria-hidden
      className="hidden bg-secondary lg:flex lg:w-[40%] lg:flex-col lg:justify-between lg:p-12"
    >
      <Image
        src="/logo.png"
        alt=""
        width={200}
        height={58}
        priority
        className="h-14 w-auto brightness-0 invert"
      />
      <div className="space-y-4">
        <div className="h-px w-12 bg-white/25" />
        <p className="font-heading text-xl font-medium leading-snug text-white">
          Project Management System
        </p>
      </div>
      <p className="text-xs text-white/50">© DC&amp;A Hub</p>
    </aside>
  );
}
```

Note: `brightness-0 invert` renders the logo as solid white over the navy panel. If `/logo.png` is already light or multicolour and does not read well inverted, replace those two classes with a dedicated light logo asset — flag this during Task 11 visual review.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/auth-brand-panel.tsx
git commit -m "feat: add AuthBrandPanel component"
```

---

## Task 6: Split-screen AuthLayout

**Files:**
- Modify: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Replace the layout**

Replace the entire contents of `src/app/(auth)/layout.tsx` with:

```tsx
import { AuthBrandPanel } from "@/components/ui/auth-brand-panel";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AuthBrandPanel />
      {/* Skip-link target — the global skip-to-content anchor in
          src/app/layout.tsx points at #main-content. */}
      <main
        id="main-content"
        className="flex flex-1 items-center justify-center bg-background px-6 py-12 sm:px-10"
      >
        {children}
      </main>
    </div>
  );
}
```

This removes the grain overlay and the `auth-bg` radial gradient. The `.auth-bg` CSS class in `globals.css` is left in place (harmless if unused; removing it is out of scope).

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/layout.tsx"
git commit -m "feat: convert auth layout to split-screen"
```

---

## Task 7: Refactor login page

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Replace the page**

Replace the entire contents of `src/app/(auth)/login/page.tsx` with:

```tsx
"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthCard } from "@/components/ui/auth-card";
import { AuthField } from "@/components/ui/auth-field";
import { AuthAlert } from "@/components/ui/auth-alert";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  const errorParam = searchParams.get("error");
  const errorMessages: Record<string, string> = {
    auth: "Authentication failed. Please try again.",
    invite_expired:
      "Your invite link has expired or was already used. Please ask an admin to send a new invite.",
    link_expired:
      "That password reset link has expired or was already used. Request a new one below.",
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

    // Hard navigation, not router.push: a soft navigation would replay the
    // App Router's cached RSC result for "/" — which, from the logged-out
    // state, is a redirect back to /login — causing a login loop. A full
    // load forces a fresh server request that sees the new auth cookie.
    window.location.assign("/");
  }

  return (
    <AuthCard
      title="Sign in"
      description="Sign in to continue to DC&A Hub"
      footer={
        <Link
          href="/forgot-password"
          className="font-medium text-primary hover:underline"
        >
          Forgot password?
        </Link>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
        {(error || errorParam) && (
          <AuthAlert variant="error">
            {error || errorMessages[errorParam!] || "An error occurred."}
          </AuthAlert>
        )}
        <AuthField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            autoComplete="email"
            className="h-10"
          />
        </AuthField>
        <AuthField label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="current-password"
            className="h-10"
          />
        </AuthField>
        <Button
          type="submit"
          className="h-10 w-full font-semibold transition-smooth"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/login/page.tsx"
git commit -m "feat: rebuild login page with auth components"
```

---

## Task 8: Refactor forgot-password page

**Files:**
- Modify: `src/app/(auth)/forgot-password/page.tsx`

- [ ] **Step 1: Replace the page**

Replace the entire contents of `src/app/(auth)/forgot-password/page.tsx` with:

```tsx
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/ui/auth-card";
import { AuthField } from "@/components/ui/auth-field";
import { AuthAlert } from "@/components/ui/auth-alert";
import { requestPasswordReset } from "./actions";

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await requestPasswordReset({ email: email.trim() });

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  const backLink = (
    <Link
      href="/login"
      className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Back to sign in
    </Link>
  );

  if (sent) {
    return (
      <AuthCard
        title="Check your inbox"
        description="We've sent you a secure link to reset your password"
        footer={backLink}
      >
        <AuthAlert variant="success">
          If an account exists for{" "}
          <span className="font-medium">{email}</span>, a password reset link is
          on its way. Check your inbox (and spam folder).
        </AuthAlert>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="We'll email you a secure link to set a new password"
      footer={backLink}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthAlert variant="error">{error}</AuthAlert>}
        <AuthField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            autoComplete="email"
            className="h-10"
          />
        </AuthField>
        <Button
          type="submit"
          className="h-10 w-full font-semibold transition-smooth"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Sending link...
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/forgot-password/page.tsx"
git commit -m "feat: rebuild forgot-password page with auth components"
```

---

## Task 9: Refactor reset-password page

**Files:**
- Modify: `src/app/(auth)/reset-password/page.tsx`

- [ ] **Step 1: Replace the page**

Replace the entire contents of `src/app/(auth)/reset-password/page.tsx` with:

```tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { AuthCard } from "@/components/ui/auth-card";
import { AuthField } from "@/components/ui/auth-field";
import { AuthAlert } from "@/components/ui/auth-alert";

function ResetPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // After clicking the email link, /auth/callback exchanged the recovery code
  // for a session and redirected here. If there's no session, the link is
  // stale or already used — send the user back to forgot-password.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/forgot-password?error=link_expired");
        return;
      }
      setEmail(data.user.email ?? null);
      setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.replace("/");
  }

  return (
    <AuthCard
      title="Set a new password"
      description="Choose a strong password to finish resetting your account"
      footer={
        <Link
          href="/login"
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </Link>
      }
    >
      {checking ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" label="Verifying your reset link" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {email && (
            <p className="text-sm text-muted-foreground">
              Resetting password for{" "}
              <span className="font-medium text-foreground break-words">
                {email}
              </span>
            </p>
          )}
          {error && <AuthAlert variant="error">{error}</AuthAlert>}
          <AuthField label="New password" htmlFor="password">
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              placeholder="At least 12 characters"
              autoComplete="new-password"
              className="h-10"
            />
          </AuthField>
          <AuthField label="Confirm password" htmlFor="confirm">
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={12}
              placeholder="Re-enter password"
              autoComplete="new-password"
              className="h-10"
            />
          </AuthField>
          <Button
            type="submit"
            className="h-10 w-full font-semibold transition-smooth"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Update password & continue"
            )}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
```

Note: the existing page's "at least 8 characters" guard and `minLength={12}` inputs are an inconsistency carried over verbatim — do NOT fix it here, it is out of scope for a visual redesign.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/reset-password/page.tsx"
git commit -m "feat: rebuild reset-password page with auth components"
```

---

## Task 10: Refactor accept-invite page

**Files:**
- Modify: `src/app/(auth)/accept-invite/page.tsx`

- [ ] **Step 1: Replace the page**

Replace the entire contents of `src/app/(auth)/accept-invite/page.tsx` with:

```tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { AuthCard } from "@/components/ui/auth-card";
import { AuthField } from "@/components/ui/auth-field";
import { AuthAlert } from "@/components/ui/auth-alert";

function AcceptInviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The user lands here after Supabase verified their invite token and our
  // /auth/callback exchanged the code for a session. If there's no session,
  // the link is stale or was already used — send them to login.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login?error=invite_expired");
        return;
      }
      setEmail(data.user.email ?? null);
      setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.replace("/");
  }

  return (
    <AuthCard
      title="Accept your invite"
      description="Set a password to activate your account"
    >
      {checking ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" label="Verifying your invite" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {email && (
            <p className="text-sm text-muted-foreground">
              Signed in as{" "}
              <span className="font-medium text-foreground break-words">
                {email}
              </span>
            </p>
          )}
          {error && <AuthAlert variant="error">{error}</AuthAlert>}
          <AuthField label="New password" htmlFor="password">
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              placeholder="At least 12 characters"
              autoComplete="new-password"
              className="h-10"
            />
          </AuthField>
          <AuthField label="Confirm password" htmlFor="confirm">
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={12}
              placeholder="Re-enter password"
              autoComplete="new-password"
              className="h-10"
            />
          </AuthField>
          <Button
            type="submit"
            className="h-10 w-full font-semibold transition-smooth"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Set password & continue"
            )}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/accept-invite/page.tsx"
git commit -m "feat: rebuild accept-invite page with auth components"
```

---

## Task 11: Full verification

**Files:** none — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all existing tests plus the three new `tests/ui/*.test.tsx` files green.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS — no errors. Fix any unused-import warnings introduced by the refactor.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS — all four `(auth)` routes compile with no type errors.

- [ ] **Step 4: Manual visual check**

Run: `npm run dev`, then in a browser visit each route and confirm:
- `/login`, `/forgot-password` — split-screen on a wide window (navy panel left, form right); single centered column when narrowed below `lg`.
- `/reset-password`, `/accept-invite` — without a valid session these redirect away; to see the form, trigger the real email flow or temporarily inspect the checking/Spinner state.
- Navy brand panel: logo reads clearly as white. If `brightness-0 invert` makes the logo look wrong, swap in a dedicated light logo asset (see Task 5 note) — treat as a follow-up if no asset exists.
- No gradient stripe, no grain texture anywhere.
- Dark mode (if togglable): navy panel and form column both look correct.
- Tab through each form: focus rings visible; skip-link still lands on the form column.

- [ ] **Step 5: Final commit (only if Step 2 required lint fixes)**

```bash
git add -A
git commit -m "chore: lint fixes for auth redesign"
```

---

## Self-Review Notes

- **Spec coverage:** AuthLayout (T6), AuthBrandPanel (T5), AuthCard (T4), AuthField (T3), AuthAlert (T2), all four pages (T7–T10), responsive + a11y verified (T11). Gradient stripe / grain / `auth-bg` removed in T6. All spec sections covered.
- **Type consistency:** `AuthCardProps`, `AuthFieldProps`, `AuthAlertProps` match the spec; component names and import paths are identical across all consuming tasks.
- **Out of scope honored:** no auth-logic changes; the 8-vs-12 char inconsistency in reset-password is explicitly preserved; `.auth-bg` CSS left untouched.
