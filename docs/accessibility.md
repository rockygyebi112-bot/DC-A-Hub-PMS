# Accessibility conformance

**Target:** WCAG 2.1 Level AA
**Last reviewed:** 13 August 2026
**Scope:** the DC&A Hub PMS web application — admin console, staff workspace, and client portal.

This is an internal working record, not a certified audit. It states what has
been checked, how, and what remains open, so that a procurement questionnaire
can be answered honestly rather than optimistically.

## Method

Contrast ratios were measured against **composited** backgrounds in a real
browser — not against nominal token values. This matters: several colours in
this app render as text on a translucent tint of themselves, and measuring
against the underlying card instead of the blend overstates the ratio by up to
1.3 points. Keyboard behaviour was exercised with real key events, because
programmatic `.focus()` does not trigger `:focus-visible` and will report a
passing focus ring where a user sees none.

## Resolved

| Criterion | Issue | Resolution |
|---|---|---|
| 2.4.7 Focus Visible (AA) | `.focus-ring` set `outline: none`, then restored it with `hsl(var(--primary) / 0.6)`. `--primary` already holds a complete colour, so the browser received `hsl(#3c83f6 / 0.6)` — invalid, silently dropped. Workspace and portal project cards and the entire mobile bottom nav had no focus indicator. | Uses `var(--ring)` directly. Verified with a real Tab keypress. |
| 2.1.1 Keyboard (A) | Section reordering was a `span` with `role="button"`, no `tabindex`, a mouse-only handler, and an `onMouseUp` that called `.blur()`. Reordering was impossible without a mouse. | Real `<button>`, arrow-key reordering, reveals itself on focus. Six regression tests. |
| 4.1.3 Status Messages (AA) | Reordering conveyed its result only visually. | Result announced in a polite live region. |
| 1.4.3 Contrast (AA) | `muted-foreground` measured 4.26:1 on the light background and 3.93:1 on the dark muted surface. `destructive`, rendered as text on a tint of itself, measured 4.03:1. | Tokens retuned. All pairings now ≥ 4.58:1 in both themes. |
| 2.4.1 Bypass Blocks (A) | Two identical skip links (root layout and app shell) both targeting `#main-content`. | One. |

## Verified as already conforming

- **1.4.4 Resize Text** — no `maximum-scale` or `user-scalable=no`; zoom is uncapped.
- **2.3.3 Animation from Interactions** — `prefers-reduced-motion` is honoured globally.
- **1.3.1 Info and Relationships** — table headers carry `scope="col"`; form fields are associated via `label[for]`, with `aria-invalid` and `aria-describedby` wired through the form primitive.
- **4.1.2 Name, Role, Value** — icon-only controls carry `aria-label`; the dialog primitive (Base UI) provides focus trap, `aria-modal`, and focus restoration.
- **3.1.1 Language of Page** — `<html lang="en">`.

## Open / not yet verified

These are not claims of conformance. They have not been tested.

- **No end-to-end audit of authenticated pages.** Contrast and keyboard checks
  were run against the design tokens and the sign-in page. The admin,
  workspace, and portal surfaces behind authentication have not been swept
  screen by screen.
- **No assistive-technology testing.** Nothing has been driven with NVDA,
  JAWS, or VoiceOver. Semantics were verified structurally, which is not the
  same thing.
- **1.4.10 Reflow (AA)** — not verified at 320 px / 400% zoom. The layout is
  responsive and guards horizontal overflow, but this has not been measured.
- **1.4.11 Non-text Contrast (AA)** — UI component and graphical-object
  contrast (borders, chart series, status dots) has not been measured. Chart
  colours in particular are unaudited.
- **2.4.3 Focus Order** — not systematically walked on complex pages.
- **Data tables** — sorting and pagination controls have not been checked for
  correct state announcement.

## Re-running the checks

Contrast is measurable from the browser console against composited
backgrounds; keyboard behaviour must be exercised with real key events rather
than programmatic focus. The reorder regression tests live in
`tests/ui/sortable-sections.test.tsx`.

```bash
npm test
```
