# Comment @-Mentions — Design

**Date:** 2026-08-12
**Status:** Implemented. Migration `0050` still needs applying to Supabase.

## Problem

Typing `@` in an internal task comment does nothing. No list appears, no name
can be picked, and posting `@Kwame` is inert text that notifies nobody.

The confusing part is that the *consuming* half of this feature already exists.
The database has carried mention support since migration 0016: `activity_log`
accepts a `proof_mentioned` action, migration 0017 added `target_user_id` to
record "per-user @mention notifications", and 0019 cleans up orphaned
`proof_mentioned` rows. The notification labels are written
([`labels.ts`](../../../src/lib/notifications/labels.ts) maps `proof_mentioned`
to "You were mentioned"), and the bell feed even de-duplicates against them:
[`queries.ts:152-163`](../../../src/lib/notifications/queries.ts) suppresses a
broadcast `proof_commented` row for anyone listed in `meta.mentioned_user_ids`,
with a comment stating that field is "written into meta by `addProofComment`".

`addProofComment` does not exist anywhere in the tree, and nothing writes
`mentioned_user_ids`. The scaffolding was built; the producing half never was.

So the fix is not a repair — it is building the feature for the first time, on
the internal-workspace comment surfaces that exist today.

## Goals

- Typing `@` in an internal task comment opens a filtered list of colleagues;
  picking one inserts a mention.
- A posted mention renders as a visually distinct chip, not raw markup.
- The mentioned person gets an entry in the notifications bell linking to the
  task.
- A failure in the notification path never fails the comment itself.
- Works on both internal comment surfaces — the task-level feed and the
  per-document threads — without duplicating the implementation.

## Non-goals

- **Email on mention.** Bell only. Assignment already emails; mentions are
  higher-volume and lower-stakes. Revisit if people ask.
- **Project-side / client-portal comments.** The `proof_comments` table is
  orphaned — no application code reads or writes it. Reviving that surface is
  separate work, and mentions must never expose staff names to client viewers.
- **Mentioning clients or non-staff.** The picker lists staff and admins only,
  matching what `/api/internal/staff` already returns.
- **Editing a posted comment.** Comments are post-and-delete today; mentions
  do not change that.
- **Group mentions** (`@team`, `@here`) and **realtime picker updates.** The
  staff list is fetched once per composer mount, as the assignee picker does.

## Approach

Store a mention as **inline markup anchored to the user id**:
`@[Kwame Gyebi](3f2a…-uuid)`.

The considered alternative was plain text plus a `mentioned_user_ids uuid[]`
column on both comment tables. It keeps the stored body readable, but forces
every render to recover mentions by string-matching names against the staff
list — which is ambiguous when two colleagues share a first name, silently
wrong after a rename, and drifts the moment someone edits the text after
picking from the list. It also needs a migration on two tables.

Anchoring to the id makes the mention durable: renames and duplicate names both
survive, because the name in the body is only a display fallback and the id is
the truth. It needs no schema change to the comment tables. The cost is that
raw markup would leak anywhere the body is rendered as plain text — which is
confined to one place and solved by the same parser that does the rendering.

## Design

### 1. Parser — `src/lib/internal/mentions.ts`

A standalone module with no Supabase or `server-only` imports, so it unit-tests
directly — the same reasoning that put `resolveAssignmentRecipients` in its own
file.

```ts
const MENTION = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g;

/** User ids mentioned in a body, de-duplicated, in first-appearance order. */
export function extractMentionIds(body: string): string[];

/** Split a body into plain-text and mention segments for rendering. */
export function parseMentions(body: string): MentionSegment[];

/**
 * The in-progress "@query" the caret sits in, or null. Encodes the open/close
 * rules from §2 so they can be tested without driving the textarea.
 */
export function findMentionQuery(
  text: string,
  caret: number,
): { query: string; start: number } | null;
```

An earlier draft also specified a `stripMentions` helper to keep markup out of
plain-text surfaces. It was dropped during implementation: the bell row carries
the task title and section name, never the comment body, so nothing renders a
body as plain text and the helper had no caller.

### 2. Composer — `src/components/internal/comments.tsx`

`CommentComposer` is already shared by the task feed and the document threads,
so both surfaces gain mentions from one change.

- Fetch `/api/internal/staff` once on mount, exactly as `AssigneePicker` does.
- Track an active mention query: opened when `@` is typed **at the start of the
  input or immediately after whitespace**. The start/whitespace rule is what
  stops an email address (`kgyebi112@gmail.com`) from opening the picker.
- The query may contain **one internal space**, so "Kwame Gy" filters by full
  name. A second space, Escape, a pick, or moving the caret out of the query
  closes the picker. Without this, only first-name filtering would work.
- If the query matches nobody, the picker closes rather than showing an empty
  box — typing an email that slipped past the open rule then costs nothing.
- Render matches in a list below the textarea. ArrowUp/ArrowDown move, Enter or
  Tab picks, Escape dismisses. While the list is open, Enter picks rather than
  submits.
- Picking replaces the typed `@query` with `@[Full Name](user_id) `.
- The textarea shows the raw markup while composing. Rich inline chips inside a
  textarea would need a contenteditable overlay — disproportionate here, and
  the markup is only visible for the seconds before posting.

The DB constraint is `length(body) <= 4000`, and markup counts toward it. The
composer measures the stored form, not the visible text.

### 3. Rendering — `CommentBody` in `src/components/internal/comments.tsx`

Replaces the bare `{comment.body}` in `CommentRow`. Maps `parseMentions`
segments to text nodes and `<span>` chips. Output is React text nodes
throughout — no `dangerouslySetInnerHTML`, so a body containing markup-like
text cannot inject anything.

A mention of the current user gets a stronger highlight, so a person scanning a
thread can see where they were pulled in.

### 4. Notification writer — `src/lib/internal/notifications.ts`

`notifyInternalTaskMentioned({ taskId, body, actorUserId })`, mirroring
`notifyInternalTaskAssigned` in the same file: service-role client (the
recipient is another user, and `user_notifications` has no authenticated insert
policy by design), wrapped so it never throws, callers ignore the result.

Recipients come from a new `resolveMentionRecipients(mentionedIds, actorUserId)`
in [`notification-recipients.ts`](../../../src/lib/internal/notification-recipients.ts),
alongside the assignment resolver and following the same rule: de-duplicate,
never notify someone about their own action.

Row shape follows the assignment writer — `title` is the task title, `subtitle`
the section name, `href` is `/workspace/internal/{taskId}`, `actor_name` is
denormalised because `profiles` RLS hides colleagues from a user-scoped read.

Called from `postInternalTaskComment` and `addInternalProofComment` in
[`proofs.ts`](../../../src/lib/internal/proofs.ts), after the insert succeeds
and before `revalidateTask`, with `.catch()` — a mention that fails to notify
must still leave the comment posted.

### 5. Schema — `supabase/migrations/0050_internal_task_mentions.sql`

`user_notifications.type` carries `check (type in ('internal_task_assigned'))`.
Widen it to admit `'internal_task_mentioned'`. Drop and recreate the constraint;
no data migration, no new columns, no RLS change — the existing
`user_notifications_self_select` policy already scopes reads to the recipient.

### 6. Labels — `src/lib/notifications/labels.ts`

Add `internal_task_mentioned: "You were mentioned"` to `NOTIFICATION_ONLY_LABEL`.
It belongs there rather than in `ACTIVITY_ACTION_LABEL`, which that file's own
comment reserves for the `activity_log.action` enum.

The existing `proof_mentioned` entries stay untouched. They belong to the
dormant project-side surface and are out of scope.

### 7. Tests

- **`tests/internal/mentions.test.ts`** — `extractMentionIds` de-duplicates and
  preserves order, and ignores malformed markup and bare `@name`;
  `parseMentions` segments a body with text before, between, and after
  mentions. `findMentionQuery` opens at start-of-input and after whitespace,
  stays closed inside `kgyebi112@gmail.com`, accepts one internal space and
  closes on a second.
- **`tests/internal/mention-recipients.test.ts`** — the actor is filtered out;
  the same person mentioned twice yields one recipient; an empty list is safe.
- **`tests/ui/comment-body.test.tsx`** — a mention renders as a chip carrying
  the name; markup-shaped text in a body renders as literal text.

- **`tests/ui/comment-composer.test.tsx`** — the picker opens on `@`, filters
  as you type, stays shut inside an email address, inserts id-anchored markup
  on Enter, respects ArrowDown, closes on Escape without inserting, and does
  not post the comment when Enter is choosing a name. The staff fetch is
  stubbed; everything else is the real component.

The composer tests were added after the component rather than before it, so
they were checked against a deliberate mutation (markup replaced with a plain
`@Name`) to confirm they fail when the behaviour breaks.

## Error handling

- Staff fetch fails → picker silently stays empty, plain comments still post.
  Matches `AssigneePicker`'s `.catch(() => setStaff([]))`.
- Mentioned user has no profile row → notification insert skips them, logged
  and not fatal, as the assignment writer already does.
- Comment insert fails → no notification is attempted; the existing
  `{ ok: false }` toast path is unchanged.

## Known trade-offs

- **Raw markup is visible while composing.** Accepted; see §2.
- **A deleted user's mentions keep their stored name.** The chip renders the
  fallback name and stops resolving. Better than a mention vanishing from
  history.
- **No mention on subtask or task-description text.** Comments only, matching
  where people actually converse.
