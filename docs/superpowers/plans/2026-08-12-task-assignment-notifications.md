# Task Assignment Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user is assigned an internal task, send them an email and drop an entry in the in-app notifications bell.

**Architecture:** A new service-role-written `user_notifications` table holds one rendered row per recipient (simple `user_id = auth.uid()` RLS), rather than widening the project-scoped `activity_log`. A single writer module (`src/lib/internal/notifications.ts`) inserts those rows and sends the Resend emails; it is called from the two assignment server actions. The notifications feed query merges `user_notifications` into the existing `activity_log` feed for the workspace surface only, and the bell subscribes to the new table over realtime.

**Tech Stack:** Next.js 16 (App Router, server actions), Supabase (Postgres + RLS + realtime), Resend, TypeScript, Vitest.

**Spec:** [`docs/superpowers/specs/2026-08-12-task-assignment-notifications-design.md`](../specs/2026-08-12-task-assignment-notifications-design.md)

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `supabase/migrations/0049_user_notifications.sql` | Table, indexes, RLS, realtime publication |
| `src/lib/internal/notification-recipients.ts` | Pure recipient resolution (dedupe, drop actor). Separate from the writer so it unit-tests without pulling in `next/headers` via the Supabase server client. |
| `src/lib/email/templates/task-assigned.ts` | Renders the assignment email (subject/html/text) |
| `src/lib/internal/notifications.ts` | Writer: bell rows + emails. Mirrors `src/lib/workspace/notifications.ts`. |
| `tests/internal/task-assignment-notify.test.ts` | Unit tests for recipient resolution + template |
| `tests/rls/user-notifications.test.ts` | RLS: user A cannot read user B's rows |

**Modified:**

| File | Change |
|---|---|
| `src/lib/email/send.ts:5-9` | Add `"task_assigned"` to `EmailCategory` |
| `src/lib/internal/actions.ts` | Call the writer from `createTask` and `addAssignee` |
| `src/lib/notifications/labels.ts` | `NOTIFICATION_ONLY_LABEL` map + fall-through in `actionLabel` |
| `src/lib/notifications/queries.ts` | `source` field, nullable `project_id`, merge the two sources |
| `src/components/notifications/notifications-bell.tsx` | Realtime subscription on `user_notifications`, source-aware subtitle |
| `src/lib/supabase/types.ts` | Regenerated (Task 1) |

---

### Task 1: Database table

**Files:**
- Create: `supabase/migrations/0049_user_notifications.sql`
- Create: `tests/rls/user-notifications.test.ts`
- Modify: `src/lib/supabase/types.ts` (regenerated, do not hand-edit)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0049_user_notifications.sql`:

```sql
-- 0049_user_notifications.sql
--
-- Per-recipient notification inbox for events that have no project.
--
-- The notifications bell reads `activity_log`, whose project_id is NOT NULL and
-- FK'd to projects, under RLS `is_admin() OR can_access_project(project_id)`.
-- Internal tasks have no project and satisfy neither condition. Rather than
-- bend a project-scoped broadcast audit trail into a per-user inbox, this table
-- stores one already-rendered row per recipient.
--
-- Rows are written by the service-role client only (see notify* modules); there
-- is deliberately no insert policy for authenticated users.

create table user_notifications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  type             text not null check (type in ('internal_task_assigned')),
  title            text not null,          -- task title
  subtitle         text,                   -- section (area) name
  href             text,
  actor_name       text,                   -- denormalised: profiles RLS hides
                                           -- colleagues from a user-scoped read
  actor_user_id    uuid references auth.users(id) on delete set null,
  internal_task_id uuid references internal_tasks(id) on delete cascade,
  created_at       timestamptz not null default now()
);

create index user_notifications_user_idx
  on user_notifications(user_id, created_at desc);

alter table user_notifications enable row level security;

-- Read-only for the recipient. No insert policy (service-role writes only) and
-- no update policy: read state lives in user_notification_reads.last_read_at,
-- so there is nothing on a row for a user to mutate.
drop policy if exists user_notifications_self_select on user_notifications;
create policy user_notifications_self_select on user_notifications
  for select using (user_id = auth.uid());

-- Realtime so the bell can live-refresh. Guarded exactly like migration 0017.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'user_notifications'
    ) then
      alter publication supabase_realtime add table user_notifications;
    end if;
  end if;
end $$;

comment on table user_notifications is
  'Per-recipient rendered notifications for non-project events; service-role writes only.';
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: `Applying migration 0049_user_notifications.sql...` then `Finished supabase db push.`

- [ ] **Step 3: Write the RLS test**

Create `tests/rls/user-notifications.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, clientAs, createTestUser, cleanupTestData } from './setup';

afterAll(async () => { await cleanupTestData(); });

describe('user_notifications RLS', () => {
  it('a user reads only their own notifications', async () => {
    const admin = adminClient();
    const aEmail = `un-a-${Date.now()}@example.com`;
    const bEmail = `un-b-${Date.now()}@example.com`;
    const aId = await createTestUser('staff', aEmail);
    const bId = await createTestUser('staff', bEmail);

    await admin.from('user_notifications').insert([
      { user_id: aId, type: 'internal_task_assigned', title: 'Task for A' },
      { user_id: bId, type: 'internal_task_assigned', title: 'Task for B' },
    ]);

    const sbA = await clientAs(aEmail);
    const { data } = await sbA.from('user_notifications').select('title');
    const titles = (data ?? []).map((r) => r.title);
    expect(titles).toContain('Task for A');
    expect(titles).not.toContain('Task for B');
  }, 30_000);

  it('a user cannot insert a notification for someone else', async () => {
    const aEmail = `un-ins-a-${Date.now()}@example.com`;
    const bEmail = `un-ins-b-${Date.now()}@example.com`;
    await createTestUser('staff', aEmail);
    const bId = await createTestUser('staff', bEmail);

    const sbA = await clientAs(aEmail);
    const { error } = await sbA.from('user_notifications').insert({
      user_id: bId, type: 'internal_task_assigned', title: 'Injected',
    });
    expect(error).not.toBeNull();
  }, 30_000);
});
```

- [ ] **Step 4: Run the RLS test**

```bash
npm run test:rls -- user-notifications
```

Expected: 2 passed. Requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the environment.

- [ ] **Step 5: Regenerate Supabase types**

```bash
npm run db:types
```

Expected: `src/lib/supabase/types.ts` now contains a `user_notifications` entry. If the Supabase project is not linked and this fails, do NOT hand-edit the file — instead cast at the call sites the way `getNotificationFeed` already casts `user_notification_reads` (`src/lib/notifications/queries.ts:72`), and note it in the commit message.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0049_user_notifications.sql tests/rls/user-notifications.test.ts src/lib/supabase/types.ts
git commit -m "feat(db): add user_notifications table for non-project notifications"
```

---

### Task 2: Recipient resolution

**Files:**
- Create: `src/lib/internal/notification-recipients.ts`
- Test: `tests/internal/task-assignment-notify.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/internal/task-assignment-notify.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveAssignmentRecipients } from '@/lib/internal/notification-recipients';

const ACTOR = '11111111-1111-1111-1111-111111111111';
const ALICE = '22222222-2222-2222-2222-222222222222';
const BOB = '33333333-3333-3333-3333-333333333333';

describe('resolveAssignmentRecipients', () => {
  it('returns the assignees other than the actor', () => {
    expect(resolveAssignmentRecipients([ALICE, BOB], ACTOR)).toEqual([ALICE, BOB]);
  });

  it('drops the actor so nobody is notified of their own action', () => {
    expect(resolveAssignmentRecipients([ACTOR, ALICE], ACTOR)).toEqual([ALICE]);
  });

  it('returns an empty list when the actor is the only assignee', () => {
    expect(resolveAssignmentRecipients([ACTOR], ACTOR)).toEqual([]);
  });

  it('deduplicates repeated ids so nobody gets two emails', () => {
    expect(resolveAssignmentRecipients([ALICE, ALICE, BOB], ACTOR)).toEqual([ALICE, BOB]);
  });

  it('ignores empty-string ids from unfilled form fields', () => {
    expect(resolveAssignmentRecipients(['', ALICE], ACTOR)).toEqual([ALICE]);
  });

  it('handles an empty assignee list', () => {
    expect(resolveAssignmentRecipients([], ACTOR)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/internal/task-assignment-notify.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/internal/notification-recipients"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/internal/notification-recipients.ts`:

```ts
/**
 * Who actually gets notified when a task is assigned.
 *
 * Deliberately a standalone module with no Supabase or `server-only` imports:
 * the writer in `./notifications.ts` pulls in the service-role client (and
 * transitively `next/headers`), which is awkward to unit-test. The rule that
 * matters — never notify someone about their own action — lives here where it
 * can be tested directly.
 *
 * The actor can appear in `assigneeIds` when someone picks themselves in the
 * assignee picker — neither the picker nor the form excludes self. The
 * creator's auto-assignment in `createTask` is a separate insert and never
 * reaches here.
 */
export function resolveAssignmentRecipients(
  assigneeIds: string[],
  actorUserId: string,
): string[] {
  return Array.from(new Set(assigneeIds.filter(Boolean))).filter(
    (id) => id !== actorUserId,
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/internal/task-assignment-notify.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/internal/notification-recipients.ts tests/internal/task-assignment-notify.test.ts
git commit -m "feat: add assignment notification recipient resolution"
```

---

### Task 3: Email template

**Files:**
- Create: `src/lib/email/templates/task-assigned.ts`
- Modify: `src/lib/email/send.ts:5-9`
- Test: `tests/internal/task-assignment-notify.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/internal/task-assignment-notify.test.ts`:

```ts
import { renderTaskAssignedEmail } from '@/lib/email/templates/task-assigned';

describe('renderTaskAssignedEmail', () => {
  const base = {
    taskTitle: 'Draft the UNICEF inception report',
    sectionName: 'Business Development',
    dueDate: '2026-08-20',
    priority: 'high',
    assignedBy: 'Ama Mensah',
    taskUrl: 'https://pms.example.com/workspace/internal/abc-123',
  };

  it('puts the task title in the subject', () => {
    expect(renderTaskAssignedEmail(base).subject).toBe(
      "You've been assigned: Draft the UNICEF inception report",
    );
  });

  it('includes section, due date, priority and assigner in the html', () => {
    const { html } = renderTaskAssignedEmail(base);
    expect(html).toContain('Business Development');
    expect(html).toContain('2026-08-20');
    expect(html).toContain('high');
    expect(html).toContain('Ama Mensah');
    expect(html).toContain(base.taskUrl);
  });

  it('omits optional rows when they are null', () => {
    const { html, text } = renderTaskAssignedEmail({
      ...base, sectionName: null, dueDate: null, priority: null,
    });
    expect(html).not.toContain('Due:');
    expect(html).not.toContain('Priority:');
    expect(html).not.toContain('Section:');
    expect(text).not.toContain('Due:');
  });

  it('escapes html in the task title', () => {
    const { html } = renderTaskAssignedEmail({
      ...base, taskTitle: 'Fix <script>alert(1)</script> bug',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('produces a plain-text alternative ending in the link', () => {
    const { text } = renderTaskAssignedEmail(base);
    expect(text.startsWith(base.taskTitle)).toBe(true);
    expect(text.trimEnd().endsWith(base.taskUrl)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/internal/task-assignment-notify.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/email/templates/task-assigned"`.

- [ ] **Step 3: Write the template**

Create `src/lib/email/templates/task-assigned.ts`:

```ts
import { escapeHtml, renderEmailLayout } from "./layout";

export function renderTaskAssignedEmail({
  taskTitle,
  sectionName,
  dueDate,
  priority,
  assignedBy,
  taskUrl,
}: {
  taskTitle: string;
  sectionName: string | null;
  dueDate: string | null;
  priority: string | null;
  assignedBy: string;
  taskUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `You've been assigned: ${taskTitle}`;

  const detailRows = [
    sectionName ? `<p><strong>Section:</strong> ${escapeHtml(sectionName)}</p>` : "",
    dueDate ? `<p><strong>Due:</strong> ${escapeHtml(dueDate)}</p>` : "",
    priority ? `<p><strong>Priority:</strong> ${escapeHtml(priority)}</p>` : "",
  ].join("");

  const html = renderEmailLayout({
    preheader: `${assignedBy} assigned you a task on the DC&A Hub PMS`,
    title: taskTitle,
    bodyHtml: `
      <p>${escapeHtml(assignedBy)} assigned you a task.</p>
      ${detailRows}
    `,
    cta: { label: "Open task", href: taskUrl },
  });

  const text = [
    taskTitle,
    "",
    `${assignedBy} assigned you a task.`,
    sectionName ? `Section: ${sectionName}` : null,
    dueDate ? `Due: ${dueDate}` : null,
    priority ? `Priority: ${priority}` : null,
    "",
    taskUrl,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { subject, html, text };
}
```

- [ ] **Step 4: Add the email category**

In `src/lib/email/send.ts`, change:

```ts
export type EmailCategory =
  | "invite"
  | "password_reset"
  | "email_change"
  | "activity_notification";
```

to:

```ts
export type EmailCategory =
  | "invite"
  | "password_reset"
  | "email_change"
  | "activity_notification"
  | "task_assigned";
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test -- tests/internal/task-assignment-notify.test.ts
```

Expected: 11 passed (6 from Task 2 + 5 here).

- [ ] **Step 6: Commit**

```bash
git add src/lib/email/templates/task-assigned.ts src/lib/email/send.ts tests/internal/task-assignment-notify.test.ts
git commit -m "feat(email): add task assignment email template"
```

---

### Task 4: Notification writer

**Files:**
- Create: `src/lib/internal/task-labels.ts`
- Modify: `src/components/internal/task-meta.ts`
- Create: `src/lib/internal/notifications.ts`

There is no unit test for the writer module: it is thin orchestration over the
service-role Supabase client and Resend, and the two pieces worth testing (the
recipient rule and the rendered email) are already covered by Tasks 2 and 3.
It is verified end-to-end in Task 7.

**Display formatting.** `internal_tasks.due_date` is a raw ISO string and
`priority` a raw enum. Passing them through untouched would make this email the
only surface in the product showing "2026-08-20" and "high" — every other
surface formats them (`src/lib/format/date.ts`, whose header calls itself "a
single, deterministic surface to call", and `TASK_PRIORITY_META` in
`src/components/internal/task-meta.ts`). The writer therefore formats before
calling the template.

Dates are easy — `formatDate` already lives in `src/lib/`. Priority labels are
not: they sit in a `components/` module that imports `lucide-react`, and having
`src/lib/` import from `src/components/` would invert the dependency direction.
Step 1 lifts the React-free part into `src/lib/` and has the component module
build on it, so there is still exactly one source of truth for the labels.

- [ ] **Step 1: Lift the priority labels out of the component layer**

Create `src/lib/internal/task-labels.ts`:

```ts
/**
 * Priority vocabulary for internal tasks, free of React and lucide-react so
 * server code (the assignment email) can share it with the UI.
 *
 * `TASK_PRIORITY_META` in `src/components/internal/task-meta.ts` builds its
 * badge styling on top of these labels, so the email and the task card can
 * never disagree about what `high` is called.
 */
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export const TASK_PRIORITY_ORDER: TaskPriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
];

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

/** Display label for a raw DB priority value; returns null for null/unknown. */
export function priorityLabel(value: string | null): string | null {
  if (!value) return null;
  return TASK_PRIORITY_LABEL[value as TaskPriority] ?? value;
}
```

Then in `src/components/internal/task-meta.ts`, delete the local `TaskPriority`
type, `TASK_PRIORITY_ORDER`, and the hard-coded labels, and build on the new
module instead. Replace this block:

```ts
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export const TASK_PRIORITY_ORDER: TaskPriority[] = ["low", "normal", "high", "urgent"];

export const TASK_PRIORITY_META: Record<
  TaskPriority,
  { label: string; variant: "neutral" | "info" | "warning" | "destructive" }
> = {
  low: { label: "Low", variant: "neutral" },
  normal: { label: "Normal", variant: "info" },
  high: { label: "High", variant: "warning" },
  urgent: { label: "Urgent", variant: "destructive" },
};
```

with:

```ts
export type { TaskPriority };
export { TASK_PRIORITY_ORDER };

export const TASK_PRIORITY_META: Record<
  TaskPriority,
  { label: string; variant: "neutral" | "info" | "warning" | "destructive" }
> = {
  low: { label: TASK_PRIORITY_LABEL.low, variant: "neutral" },
  normal: { label: TASK_PRIORITY_LABEL.normal, variant: "info" },
  high: { label: TASK_PRIORITY_LABEL.high, variant: "warning" },
  urgent: { label: TASK_PRIORITY_LABEL.urgent, variant: "destructive" },
};
```

and add this import at the top of the file, below the `lucide-react` import:

```ts
import {
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_ORDER,
  type TaskPriority,
} from "@/lib/internal/task-labels";
```

Existing consumers import `TaskPriority`, `TASK_PRIORITY_ORDER`, and
`TASK_PRIORITY_META` from `task-meta.ts` and keep working unchanged, because
the first two are re-exported.

Verify nothing broke: `npx tsc --noEmit` must pass before you continue.

- [ ] **Step 2: Write the module**

Create `src/lib/internal/notifications.ts`:

```ts
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import { formatDate } from "@/lib/format/date";
import { sendEmail } from "@/lib/email/send";
import { renderTaskAssignedEmail } from "@/lib/email/templates/task-assigned";
import { resolveAssignmentRecipients } from "./notification-recipients";
import { priorityLabel } from "./task-labels";

/**
 * Notify staff that they've been assigned an internal task: one
 * `user_notifications` row (the bell) plus one email each.
 *
 * Uses the service-role client because it writes rows scoped to OTHER users —
 * `user_notifications` has no insert policy for authenticated users by design,
 * and `profiles` RLS hides colleagues from a user-scoped read.
 *
 * Never throws. Assignment must succeed even when notification doesn't, so
 * callers `await` this with a `.catch()` and ignore the result.
 */
export async function notifyInternalTaskAssigned({
  taskId,
  assigneeIds,
  actorUserId,
}: {
  taskId: string;
  assigneeIds: string[];
  actorUserId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const recipients = resolveAssignmentRecipients(assigneeIds, actorUserId);
  if (recipients.length === 0) return { ok: true };

  const admin = createAdminClient();

  const { data: task } = await admin
    .from("internal_tasks")
    .select("id, title, due_date, priority, area_id")
    .eq("id", taskId)
    .single();
  if (!task) return { ok: false, reason: "Task not found" };

  const [{ data: area }, { data: profiles }, { data: actor }] = await Promise.all([
    admin.from("internal_areas").select("name").eq("id", task.area_id).maybeSingle(),
    admin
      .from("profiles")
      .select("user_id, email, full_name")
      .in("user_id", recipients),
    admin
      .from("profiles")
      .select("full_name")
      .eq("user_id", actorUserId)
      .maybeSingle(),
  ]);

  const sectionName = area?.name ?? null;
  const assignedBy = actor?.full_name ?? "A colleague";
  const href = `/workspace/internal/${taskId}`;

  // Bell rows first — these must survive a Resend outage.
  const { error: insertError } = await admin.from("user_notifications").insert(
    recipients.map((userId) => ({
      user_id: userId,
      type: "internal_task_assigned",
      title: task.title,
      subtitle: sectionName,
      href,
      actor_name: assignedBy,
      actor_user_id: actorUserId,
      internal_task_id: taskId,
    })),
  );
  if (insertError) {
    console.error("[notify-task-assigned] bell insert failed", insertError);
  }

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, reason: "RESEND_API_KEY is not configured" };
  }

  // Formatted here, not in the template: the template is a dumb renderer, and
  // these are the same labels the task card and detail page show.
  const { subject, html, text } = renderTaskAssignedEmail({
    taskTitle: task.title,
    sectionName,
    dueDate: task.due_date ? formatDate(task.due_date) : null,
    priority: priorityLabel(task.priority ?? null),
    assignedBy,
    taskUrl: `${getAppUrl()}${href}`,
  });

  const results = await Promise.all(
    (profiles ?? [])
      .filter((profile) => Boolean(profile.email))
      .map((profile) =>
        sendEmail({
          to: profile.email,
          subject,
          html,
          text,
          category: "task_assigned",
          // Keyed per (task, recipient) so a retry inside Resend's 24h window
          // can't double-send.
          idempotencyKey: `internal-task-assigned/${taskId}/${profile.user_id}`,
          extraTags: [{ name: "internal_task_id", value: taskId }],
        }),
      ),
  );

  const failed = results.find((result) => !result.ok);
  if (failed && !failed.ok) return { ok: false, reason: failed.error };
  return { ok: true };
}
```

- [ ] **Step 3: Verify it typechecks and lints**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors. `tsc` also confirms Step 1's refactor didn't break any existing `TASK_PRIORITY_META` / `TaskPriority` consumer. If `user_notifications` is unknown to the generated types because Step 5 of Task 1 could not run, add `// @ts-expect-error user_notifications lands in types.ts once db:types runs` above the `.from("user_notifications")` call rather than weakening the client's typing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/internal/task-labels.ts src/components/internal/task-meta.ts src/lib/internal/notifications.ts
git commit -m "feat: add internal task assignment notification writer"
```

---

### Task 5: Wire the server actions

**Files:**
- Modify: `src/lib/internal/actions.ts` (imports, `createTask`, `addAssignee`)

- [ ] **Step 1: Add the import**

In `src/lib/internal/actions.ts`, below the existing `import { areaSchema, taskSchema } from './schemas';` line, add:

```ts
import { notifyInternalTaskAssigned } from './notifications';
```

- [ ] **Step 2: Notify from `createTask`**

In `createTask`, replace this block (currently the `Optional initial assignees` section):

```ts
  // Optional initial assignees from a hidden "assignee_ids" multi-select.
  const extraRaw = (formData.getAll('assignee_ids') as string[]).filter(Boolean);
  if (extraRaw.length) {
    const parsedIds = idsSchema.safeParse(extraRaw);
    if (parsedIds.success && parsedIds.data.length) {
      await sb
        .from('internal_task_assignees')
        .upsert(
          parsedIds.data.map((uid) => ({ task_id: task.id, user_id: uid })),
          { onConflict: 'task_id,user_id', ignoreDuplicates: true },
        );
    }
  }
```

with:

```ts
  // Optional initial assignees from a hidden "assignee_ids" multi-select.
  const extraRaw = (formData.getAll('assignee_ids') as string[]).filter(Boolean);
  if (extraRaw.length) {
    const parsedIds = idsSchema.safeParse(extraRaw);
    if (parsedIds.success && parsedIds.data.length) {
      await sb
        .from('internal_task_assignees')
        .upsert(
          parsedIds.data.map((uid) => ({ task_id: task.id, user_id: uid })),
          { onConflict: 'task_id,user_id', ignoreDuplicates: true },
        );
      // Notification failures must never fail the assignment — same pattern as
      // notifyClientViewersActivityDone in src/lib/workspace/actions.ts.
      await notifyInternalTaskAssigned({
        taskId: task.id,
        assigneeIds: parsedIds.data,
        actorUserId: userId,
      }).catch((err) => {
        console.error('[createTask] assignment notification failed', err);
      });
    }
  }
```

- [ ] **Step 3: Notify from `addAssignee`**

The existing upsert uses `ignoreDuplicates: true`, so re-adding someone who is
already assigned is a database no-op. Notifying unconditionally would then send
a fresh bell row to a person whose assignment did not change. Adding `.select()`
makes the upsert report what it actually inserted, so the notification fires
only on a real assignment. (The UI filters current assignees out of the picker,
so this is reachable only from a stale client — but "nothing changed" should
mean "nothing sent".)

Replace the whole `addAssignee` function with:

```ts
export async function addAssignee(
  taskId: string,
  userId: string,
): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const sb = await createClient();
  // `.select()` so an ignored duplicate comes back as an empty array: re-adding
  // an existing assignee changes nothing and must not notify.
  const { data: inserted, error } = await sb
    .from('internal_task_assignees')
    .upsert(
      { task_id: taskId, user_id: userId },
      { onConflict: 'task_id,user_id', ignoreDuplicates: true },
    )
    .select('user_id');
  if (error) return { ok: false, error: dbErrorMessage(error) };

  const actorUserId = await currentUserId();
  if (actorUserId && (inserted?.length ?? 0) > 0) {
    // Notification failures must never fail the assignment.
    await notifyInternalTaskAssigned({
      taskId,
      assigneeIds: [userId],
      actorUserId,
    }).catch((err) => {
      console.error('[addAssignee] assignment notification failed', err);
    });
  }

  revalidatePath(`/workspace/internal/${taskId}`);
  return { ok: true };
}
```

`createSubtask` is deliberately left alone: it assigns only the creator, and
`resolveAssignmentRecipients` would return an empty list anyway. People added to
a subtask later go through `addAssignee`.

- [ ] **Step 4: Verify it typechecks and lints**

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/internal/actions.ts
git commit -m "feat: notify assignees when an internal task is assigned"
```

---

### Task 6: Merge into the notifications feed

**Files:**
- Modify: `src/lib/notifications/labels.ts`
- Modify: `src/lib/notifications/queries.ts`
- Modify: `src/components/notifications/notifications-bell.tsx`

- [ ] **Step 1: Add the label**

In `src/lib/notifications/labels.ts`, add this map immediately after
`ACTIVITY_ACTION_VERB`:

```ts
/**
 * Labels for notification types that are NOT activity_log actions. Kept apart
 * from ACTIVITY_ACTION_LABEL so the ActivityAction union stays in sync with the
 * activity_log.action DB enum, as the comment above promises. These come from
 * `user_notifications.type` and only ever appear in the bell — the admin
 * dashboard feed reads activity_log alone, so they need no VERB entry.
 */
export const NOTIFICATION_ONLY_LABEL: Record<string, string> = {
  internal_task_assigned: "You were assigned a task",
};
```

Then change `actionLabel` to fall through to it:

```ts
/** Look up the headline label; fallback humanises unknown action codes. */
export function actionLabel(action: string): string {
  return (
    ACTIVITY_ACTION_LABEL[action as ActivityAction] ??
    NOTIFICATION_ONLY_LABEL[action] ??
    action.replaceAll("_", " ")
  );
}
```

- [ ] **Step 2: Widen the entry type**

In `src/lib/notifications/queries.ts`, change the `NotificationEntry` type's
`project_id` line and add `source`:

```ts
export type NotificationEntry = {
  id: string;
  /**
   * Which table this came from. `activity_log` rows are project-scoped events;
   * `user_notification` rows are per-recipient messages with no project (e.g.
   * internal task assignment), so `project_id` is null and `project_name`
   * carries a section name instead.
   */
  source: "activity_log" | "user_notification";
  action: string;
  created_at: string;
  project_id: string | null;
  project_name: string | null;
  activity_id: string | null;
  activity_name: string | null;
  actor_name: string | null;
  href: string | null;
  meta: Record<string, unknown> | null;
};
```

- [ ] **Step 3: Tag existing rows with the source**

In the same file, inside `getNotificationFeed`, the `formatted` mapping builds
each entry object. Add `source: "activity_log" as const,` as its first
property, so the object literal begins:

```ts
    return {
      id: row.id,
      source: "activity_log" as const,
      action: row.action,
```

- [ ] **Step 4: Fetch the internal notifications**

Add this helper to `src/lib/notifications/queries.ts`, above
`getNotificationFeed`:

```ts
type UserNotificationRow = {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  href: string | null;
  actor_name: string | null;
  created_at: string;
};

/**
 * Per-recipient notifications (migration 0049) mapped onto the shared entry
 * shape: the task title renders as the headline suffix and the section name as
 * the subtitle, so the bell needs no special-casing beyond the label lookup.
 *
 * Workspace-only by design — clients in the portal must never see internal work.
 */
async function fetchUserNotifications(
  sb: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<NotificationEntry[]> {
  const { data, error } = await sb
    .from("user_notifications")
    .select("id, type, title, subtitle, href, actor_name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (error) {
    console.error("[notifications] user_notifications read failed", error);
    return [];
  }
  // If `npm run db:types` (Task 1, Step 5) could not run, `user_notifications`
  // is absent from the generated types and the `.from(...)` line will not
  // typecheck. Cast the table name the way this file already casts
  // `user_notification_reads` rather than weakening the client's typing.
  return ((data ?? []) as UserNotificationRow[]).map((row) => ({
    id: row.id,
    source: "user_notification" as const,
    action: row.type,
    created_at: row.created_at,
    project_id: null,
    project_name: row.subtitle,
    activity_id: null,
    activity_name: row.title,
    actor_name: row.actor_name,
    href: row.href,
    meta: null,
  }));
}
```

- [ ] **Step 5: Merge the two sources**

First, start the fetch early so it overlaps the activity_log hydration — and,
critically, so it exists *before* the early return you edit in Step 6.
Immediately after the `const lastReadAt = cursor?.last_read_at ?? null;` line,
add:

```ts
  // Started here (not awaited) so it overlaps the activity_log hydration below,
  // and so the early return further down can still await it.
  const internalEntriesPromise: Promise<NotificationEntry[]> =
    hrefBase === "workspace"
      ? fetchUserNotifications(sb, user.id)
      : Promise.resolve([]);
```

Then, at the end of the function, replace:

```ts
  const unreadCount = lastReadAt
    ? formatted.filter((e) => e.created_at > lastReadAt).length
    : formatted.length;

  return {
    entries: formatted,
    unreadCount,
    lastReadAt,
  };
```

Replace that with:

```ts
  const merged = [...formatted, ...(await internalEntriesPromise)]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, FEED_LIMIT);

  const unreadCount = lastReadAt
    ? merged.filter((e) => e.created_at > lastReadAt).length
    : merged.length;

  return {
    entries: merged,
    unreadCount,
    lastReadAt,
  };
```

- [ ] **Step 6: Fix the two early returns**

`getNotificationFeed` returns early in two places that would now skip the
internal notifications entirely. Change the empty-entries return:

```ts
  if (entries.length === 0) {
    return { entries: [], unreadCount: 0, lastReadAt };
  }
```

to:

```ts
  if (entries.length === 0) {
    const internalOnly = (await internalEntriesPromise).slice(0, FEED_LIMIT);
    const unread = lastReadAt
      ? internalOnly.filter((e) => e.created_at > lastReadAt).length
      : internalOnly.length;
    return { entries: internalOnly, unreadCount: unread, lastReadAt };
  }
```

The unauthenticated early return at the top of the function is correct as-is —
leave it alone.

- [ ] **Step 7: Subscribe the bell to the new table**

In `src/components/notifications/notifications-bell.tsx`, inside the async IIFE
in the realtime `useEffect`, the current code reads:

```ts
      channel = sb
        .channel(`notifications-bell-${surface}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "activity_log" },
          scheduleRefresh,
        )
        .subscribe((status) => {
```

Capture the user id from the session that is already fetched just above, then
chain a second listener. Replace the whole block from `const { data } = await
sb.auth.getSession();` down to the `.subscribe(...)` call with:

```ts
      let userId: string | undefined;
      try {
        const { data } = await sb.auth.getSession();
        userId = data.session?.user.id;
        const token = data.session?.access_token;
        if (token) {
          await sb.realtime.setAuth(token);
        }
      } catch {
        // best-effort; the subscription will still be attempted below
      }
      if (cancelled) return;
      let builder = sb
        .channel(`notifications-bell-${surface}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "activity_log" },
          scheduleRefresh,
        );
      // Internal-task notifications (migration 0049) are per-recipient, so the
      // subscription is filtered to this user's rows. Workspace only — the
      // portal feed never includes them.
      if (surface === "workspace" && userId) {
        builder = builder.on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${userId}`,
          },
          scheduleRefresh,
        );
      }
      channel = builder.subscribe((status) => {
```

- [ ] **Step 8: Make the bell subtitle source-aware**

In the same file, the entry row currently renders:

```tsx
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {entry.project_name ?? "Project"}
                        {entry.actor_name ? ` · by ${entry.actor_name}` : ""}
                      </p>
```

Replace with:

```tsx
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {/* activity_log rows always belong to a project; a
                            user_notification carries a section name that may be
                            absent, and "Project" would be a lie there. */}
                        {entry.source === "user_notification"
                          ? entry.project_name
                          : entry.project_name ?? "Project"}
                        {entry.actor_name ? ` · by ${entry.actor_name}` : ""}
                      </p>
```

- [ ] **Step 9: Verify typecheck, lint and the full suite**

```bash
npx tsc --noEmit && npm run lint && npm test
```

Expected: no type errors, no lint errors, all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/lib/notifications/labels.ts src/lib/notifications/queries.ts src/components/notifications/notifications-bell.tsx
git commit -m "feat: surface task assignments in the notifications bell"
```

---

### Task 7: End-to-end verification

**Files:** none modified — this is a manual verification pass.

- [ ] **Step 1: Start the dev server**

Start the app through the preview tooling (not a bare `npm run dev`), then sign
in as an admin.

- [ ] **Step 2: Assign a task to another user**

Go to `/workspace/internal`, open any task, and add a *different* staff user as
an assignee via the assignee picker.

- [ ] **Step 3: Verify the bell row**

Query the table directly:

```bash
npx supabase db query "select user_id, type, title, subtitle, actor_name from user_notifications order by created_at desc limit 5"
```

Expected: one row for the assigned user, `type = internal_task_assigned`, the
task title in `title`, the section in `subtitle`, and the assigner in
`actor_name`. There must be **no** row for the admin who did the assigning.

- [ ] **Step 4: Verify the bell renders it**

Sign in as the assigned user. The bell shows an unread badge and an entry
reading "You were assigned a task: <task title>" with the section underneath.
Clicking it navigates to `/workspace/internal/<taskId>`.

- [ ] **Step 5: Verify the email**

Check the Resend dashboard for a delivery tagged `category=task_assigned`. If
`RESEND_API_KEY` is unset locally, confirm instead that the server log records
the `RESEND_API_KEY is not configured` reason and that Step 3's bell row still
exists — that is the intended degraded behaviour.

- [ ] **Step 6: Verify the portal is unaffected**

Sign in as a client user and open the portal. The bell must show only
project activity — no internal task entries.

- [ ] **Step 7: Commit any fixes**

If Steps 2–6 surfaced defects, fix them and commit with a
`fix: <what was wrong>` message. If everything passed, there is nothing to
commit.

---

## Done when

- Assigning a user to an internal task writes a `user_notifications` row and
  sends them an email.
- The assigner never notifies themselves.
- The bell shows the entry on the workspace surface and live-refreshes.
- The portal bell is unchanged.
- A notification failure leaves the assignment intact.
- `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run test:rls` all pass.
