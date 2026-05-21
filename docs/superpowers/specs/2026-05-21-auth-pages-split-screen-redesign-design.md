# Auth Pages — Split-Screen Redesign

**Date:** 2026-05-21
**Status:** Approved design — ready for implementation plan

## Goal

Give the four auth screens (`login`, `forgot-password`, `reset-password`,
`accept-invite`) a clean, professional, "not AI-ish" look using a
corporate-restrained split-screen layout. Apply consistently across all four
pages and consolidate duplicated markup into reusable components.

## Problem with current state

- Each `page.tsx` repeats the card shell, gradient top stripe, logo header, and
  hand-rolled error/success banners.
- Visual cues that read as "AI-ish": gradient stripe (`primary → secondary`),
  grain-noise overlay, radial-gradient `auth-bg`, uppercase micro-labels.

## Visual direction

Corporate-restrained split-screen (Linear/Stripe style). Removed: gradient
stripe, grain overlay, `auth-bg` radial gradients. The form side uses a plain
`--background`.

## Architecture

Layered structure replacing per-page duplication:

- **`AuthLayout`** (`src/app/(auth)/layout.tsx`) — split-screen container.
  Left: brand panel. Right: scrollable, centered form column. Collapses to a
  single column below `lg`. Keeps the `#main-content` skip target on the form
  column.
- **`AuthBrandPanel`** — new component. Solid navy (`bg-secondary`,
  #031B4E), reversed-out logo, tagline, thin hairline divider, quiet footer
  line. Hidden below `lg`. `aria-hidden` (decorative — logo is duplicated in
  the card). No props.
- **`AuthCard`** — new component. Form-side wrapper. No gradient stripe, no
  grain. Renders a mobile-only small logo, `<h1>` title, optional description,
  the form body, and an optional footer separated by a hairline.
- **`AuthField`** — new component. Wraps `Label` + input with a real-case
  label and consistent `space-y-1.5` spacing.
- **`AuthAlert`** — new component. The error/success banner, currently
  hand-rolled 3+ times. Error variant gets `role="alert"`.

The four `page.tsx` files keep only their state, submit handlers, and the
`AuthField`/`Button` composition rendered inside `<AuthCard>`.

## Component locations

New components live in `src/components/ui/` alongside existing primitives
(`auth-brand-panel.tsx`, `auth-card.tsx`, `auth-field.tsx`, `auth-alert.tsx`),
matching the existing `back-button.tsx` / `empty-state.tsx` convention.

## Props design

```ts
// AuthBrandPanel — no props (static presentation)

interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode; // form body
  footer?: React.ReactNode;  // e.g. "Back to sign in" link
}

interface AuthFieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode; // the input element
}

interface AuthAlertProps {
  variant: "error" | "success";
  children: React.ReactNode;
}
```

## Brand panel content

- Solid `bg-secondary` navy; works in light and dark mode without extra art.
- Reversed-out logo near the top.
- Tagline: "Project Management System".
- Thin hairline divider.
- Footer line: "© DC&A Hub".

## States & edge cases

- **Loading** — buttons keep the existing spinner + `disabled` pattern.
- **Checking session** — `reset-password` / `accept-invite` render a centered
  `Spinner` inside `AuthCard` while verifying the session.
- **Errors / success** — routed through `AuthAlert`.
- **Long emails** — wrap via `break-words`.
- **Session-expired redirects** — auth logic is untouched; only markup changes.

## Responsive

- `lg+`: two columns. Brand panel ~40% fixed width. Form column centered,
  `max-w-sm`.
- Below `lg`: brand panel hidden; single centered column; small logo shown
  inside `AuthCard`.

## Accessibility

- `#main-content` skip target stays on the form column.
- One `<h1>` per page (the `AuthCard` title).
- `AuthAlert` error variant has `role="alert"`.
- Brand panel is `aria-hidden` (decorative).
- Inputs keep `autoComplete` and `Label htmlFor` associations.
- Focus rings use the existing `--ring` token.

## Out of scope

- No changes to auth logic, server actions, or Supabase calls.
- No new image assets (solid navy panel chosen specifically to avoid this).
- No changes to non-auth pages.
