# Task Assignment Notifications — Design

**Date:** 2026-08-12
**Status:** Approved — ready for implementation planning

## Problem

Assigning someone an internal task is silent. `createTask` and `addAssignee`
([`src/lib/internal/actions.ts`](../../../src/lib/internal/actions.ts)) write a
row into `internal_task_assignees` and stop there. The assignee finds out only
by opening `/workspace/internal` and noticing new work — which means, in
practice, that assignment depends on someone also sending a WhatsApp message.

The PMS already has both delivery channels built and working:

- **Email** — Resend, wrapped by [`src/lib/email/send.ts`](../../../src/lib/email/send.ts),
  with an idempotency key and category tagging. Used today for invites,
  password resets, email changes, and activity-completion notices.
- **In-app bell** — [`NotificationsBell`](../../../src/components/notifications/notifications-bell.tsx),
  a self-loading client component with realtime refresh and a per-user read
  cursor.

Neither is wired to assignment. The bell additionally *cannot* be, as built:
it reads exclusively from `activity_log`, whose `project_id` is `NOT NULL` and
foreign-keyed to `projects`, under an RLS policy of
`is_admin() OR can_access_project(project_id)`. Internal tasks have no project
and satisfy neither condition.

## Goals

- When a user is assigned an internal task, they receive an email and an entry
  in the notifications bell.
- Notifications are targeted: only the assignee sees them.
- A failure in the notification path never fails the assignment itself.
- Leave a home for future non-project notifications (internal-task comment
  mentions, due-date reminders) that does not require widening the project
  schema again.

## Non-goals

- **Project activities.** `activities.responsible` is free text
  (`z.string().trim().max(200)`), not a user reference, so there is no person to
  notify. Adding user-based assignment to activities is a separate, larger
  change.
- **Per-user opt-out.** Assignment notifications are low-volume and
  high-signal. No preference column, no account-page toggle. Revisit if people
  complain.
- **Notifications on unassignment, status change, due-date change, or
  comments.** Assignment only.
- **Digesting or batching.** Sends are immediate; assigning three people sends
  three separate emails.

## Approach

A new **`user_notifications` table** holding one row per recipient, rather than
extending `activity_log`.

`activity_log` is a project-scoped broadcast audit trail. Making `project_id`
nullable and bolting on an `internal_task_id` would save perhaps sixty lines
now, at the cost of an RLS policy that special-cases null-project rows and an
audit log that is no longer purely an audit log. Every future notification type
would widen it further. A dedicated table has trivial RLS
(`user_id = auth.uid()`), is targeted by construction, and keeps the two
concepts separate.

## Design

### 1. Schema — `supabase/migrations/0049_user_notifications.sql`

```sql
create table user_notifications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  type             text not null check (type in ('internal_task_assigned')),
  title            text not null,          -- task title
  subtitle         text,                   -- section (area) name
  href             text,
  actor_name       text,                   -- denormalised for display
  actor_user_id    uuid references auth.users(id) on delete set null,
  internal_task_id uuid references internal_tasks(id) on delete cascade,
  created_at       timestamptz not null default now()
);
create index user_notifications_user_idx
  on user_notifications(user_id, created_at desc);
```

**RLS.** A single `select` policy, `user_id = auth.uid()`. No `update` policy —
with read state held in the cursor table there is nothing on a row for a user
to mutate. There is deliberately **no insert policy** either: writes go through
the service-role admin
client (`createAdminClient()`), the same way
[`notifyClientViewersActivityDone`](../../../src/lib/workspace/notifications.ts)
already writes across users. An assigner has no business inserting rows scoped
to someone else under their own credentials.

**Realtime.** Added to the `supabase_realtime` publication using the same
existence guard as migration 0017.

**`actor_name` is denormalised** alongside `actor_user_id`. `profiles` RLS only
exposes self, admin, and shared-project rows, so a user-scoped feed query
cannot resolve a colleague's name — `src/lib/internal/queries.ts` already works
around this with a service-role read. A notification row is a *rendered*
message, not a normalised event, so storing the display name at write time
keeps the feed query on the plain user client. `actor_user_id` is retained for
provenance.

**No `read_at` column.** Read state is already a per-user cursor —
`user_notification_reads.last_read_at`, upserted by `markNotificationsRead()`.
Adding `read_at` here would create two sources of truth for one question. The
existing cursor covers both sources, and the unread count stays a timestamp
comparison.

### 2. Writer — `src/lib/internal/notifications.ts`

New module, mirroring the shape of `src/lib/workspace/notifications.ts`
(`import "server-only"`, admin client, returns a result rather than throwing).

```ts
export async function notifyInternalTaskAssigned({
  taskId,
  assigneeIds,
  actorUserId,
}: {
  taskId: string;
  assigneeIds: string[];
  actorUserId: string;
}): Promise<{ ok: boolean; reason?: string }>
```

Sequence:

1. Dedupe `assigneeIds` and remove `actorUserId`. Return `{ ok: true }`
   immediately if nothing remains — this is the common case for `createTask`,
   where the creator is auto-assigned for visibility.
2. Via the admin client, fetch the task (`title`, `due_date`, `priority`,
   `area_id`), its area name, the recipients' profiles (`user_id`, `email`,
   `full_name`), and the actor's `full_name`.
3. Insert one `user_notifications` row per recipient.
4. Send one email per recipient, keyed
   `internal-task-assigned/${taskId}/${userId}`.

Bell rows are written **before** email so a Resend outage still leaves the
in-app notification intact. If `RESEND_API_KEY` is unset the function still
writes bell rows and returns `{ ok: false, reason }` for the email half,
matching the existing module's behaviour.

### 3. Email template — `src/lib/email/templates/task-assigned.ts`

```ts
renderTaskAssignedEmail({
  taskTitle, sectionName, dueDate, priority, assignedBy, taskUrl,
}): { subject: string; html: string; text: string }
```

Built on the existing `renderEmailLayout` / `escapeHtml` helpers, matching
`activity-done.ts`. Subject: `You've been assigned: <task title>`. CTA button
"Open task" → `${getAppUrl()}/workspace/internal/${taskId}`. Due date and
priority are rendered only when present.

`EmailCategory` in `src/lib/email/send.ts` gains `"task_assigned"`.

### 4. Call sites — `src/lib/internal/actions.ts`

| Function | Call |
|---|---|
| `createTask` | After the `assignee_ids` upsert, with the parsed id list. |
| `addAssignee` | With `[userId]`. |
| `createSubtask` | None — it assigns only the creator. Later additions go through `addAssignee`. |

Both calls are `await`ed with `.catch()` so a notification failure is swallowed
and the assignment still succeeds — the pattern already used at
[`src/lib/workspace/actions.ts:631`](../../../src/lib/workspace/actions.ts).

### 5. Feed and bell

**`src/lib/notifications/queries.ts`** — `NotificationEntry` gains
`source: "activity_log" | "user_notification"`, and `project_id` widens to
`string | null`. `getNotificationFeed` queries `user_notifications` for the
current user **only when `hrefBase === "workspace"`** — clients in the portal
must never see internal work — then merges both sources, sorts by `created_at`
descending, and slices to `FEED_LIMIT`. The unread count is unchanged: it
already just compares `created_at` against `lastReadAt`.

New rows map onto the existing render path:

| Entry field | Value |
|---|---|
| `action` | `"internal_task_assigned"` |
| `activity_name` | task title (renders as the headline suffix) |
| `project_name` | section name (renders as the subtitle) |
| `actor_name` | assigner's name (read straight off the row) |
| `href` | `/workspace/internal/<taskId>` |
| `project_id` | `null` |

**`src/lib/notifications/labels.ts`** — a separate `NOTIFICATION_ONLY_LABEL`
map holds `internal_task_assigned` → `"You were assigned a task"`, and
`actionLabel()` falls through to it. The existing `ActivityAction` union stays
strictly in sync with the `activity_log.action` DB enum, as its comment
promises, and no `VERB` entry is needed — the admin dashboard feed reads
`activity_log` only.

**`NotificationsBell`** — one added `.on("postgres_changes", …)` for INSERTs on
`user_notifications`, filtered to `user_id=eq.<uid>`, on the existing channel
and reusing the existing 800 ms debounce. The user id comes from the
`sb.auth.getSession()` call the component already makes. The subtitle line's
`entry.project_name ?? "Project"` fallback becomes source-aware so internal
rows do not render a bare "Project".

### 6. Tests

- `tests/internal/task-assignment-notify.test.ts` — recipient computation
  (dedupe, actor excluded, empty-set short-circuit) and template rendering,
  following the pure-function style of `tests/workspace/*`.
- `tests/rls/` — user A cannot select user B's `user_notifications` rows.

## Error handling

| Failure | Behaviour |
|---|---|
| Resend down / `RESEND_API_KEY` unset | Bell row still written; assignment succeeds; reason returned and logged. |
| `user_notifications` insert fails | Logged; email still attempted; assignment succeeds. |
| Recipient profile has no email | That recipient is skipped for email, still gets the bell row. |
| Task or area fetch fails | Notification abandoned, `{ ok: false }` returned; assignment succeeds. |

## Known trade-off

Unassigning and reassigning the same person notifies them again, deduped only
by Resend's 24-hour idempotency window on an identical key. This is intended:
a genuine reassignment is worth a second notification. If it proves noisy, a
unique index on `(user_id, internal_task_id, type)` would suppress repeats.
