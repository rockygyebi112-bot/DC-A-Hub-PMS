import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import { formatDate } from "@/lib/format/date";
import { sendEmail } from "@/lib/email/send";
import { renderTaskAssignedEmail } from "@/lib/email/templates/task-assigned";
import {
  resolveAssignmentRecipients,
  resolveMentionRecipients,
} from "./notification-recipients";
import { extractMentionIds } from "./mentions";
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
export async function notifyInternalTaskAssigned(params: {
  taskId: string;
  assigneeIds: string[];
  actorUserId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    return await deliver(params);
  } catch (err) {
    // The contract above is load-bearing: callers are entitled to skip their
    // own .catch(). Misconfigured env (RESEND_FROM_EMAIL, service-role key)
    // throws from deep inside the email/supabase clients.
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[notify-task-assigned] unexpected failure", err);
    return { ok: false, reason };
  }
}

/**
 * Notify staff that they were @mentioned in an internal task comment: one
 * `user_notifications` row each, and no email — mentions are higher-volume
 * and lower-stakes than assignment, so the bell carries them alone.
 *
 * Same service-role reasoning and same never-throws contract as
 * {@link notifyInternalTaskAssigned}: the comment is already saved by the time
 * this runs, and must stay saved even if notifying fails.
 */
export async function notifyInternalTaskMentioned(params: {
  taskId: string;
  body: string;
  actorUserId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    return await deliverMentions(params);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[notify-task-mentioned] unexpected failure", err);
    return { ok: false, reason };
  }
}

async function deliverMentions({
  taskId,
  body,
  actorUserId,
}: {
  taskId: string;
  body: string;
  actorUserId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const recipients = resolveMentionRecipients(
    extractMentionIds(body),
    actorUserId,
  );
  if (recipients.length === 0) return { ok: true };

  const admin = createAdminClient();

  const { data: task } = await admin
    .from("internal_tasks")
    .select("id, title, area_id")
    .eq("id", taskId)
    .single();
  if (!task) {
    const reason = "Task not found";
    console.error("[notify-task-mentioned]", reason);
    return { ok: false, reason };
  }

  const [{ data: area }, { data: actor }] = await Promise.all([
    admin.from("internal_areas").select("name").eq("id", task.area_id).maybeSingle(),
    admin
      .from("profiles")
      .select("full_name")
      .eq("user_id", actorUserId)
      .maybeSingle(),
  ]);

  // A mention names someone who may not be on the task at all — that is the
  // point of mentioning them — so unlike assignment there is no membership to
  // check. The picker only offers staff and admins, and `user_notifications`
  // is readable solely by its recipient.
  const { error: insertError } = await admin.from("user_notifications").insert(
    recipients.map((userId) => ({
      user_id: userId,
      type: "internal_task_mentioned",
      title: task.title,
      subtitle: area?.name ?? null,
      href: `/workspace/internal/${taskId}`,
      actor_name: actor?.full_name ?? "A colleague",
      actor_user_id: actorUserId,
      internal_task_id: taskId,
    })),
  );
  if (insertError) {
    console.error("[notify-task-mentioned] bell insert failed", insertError);
    return { ok: false, reason: insertError.message };
  }

  return { ok: true };
}

async function deliver({
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
  if (!task) {
    const reason = "Task not found";
    console.error("[notify-task-assigned]", reason);
    return { ok: false, reason };
  }

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

  if ((profiles?.length ?? 0) !== recipients.length) {
    console.warn("[notify-task-assigned] some recipients have no profile row", {
      recipients: recipients.length,
      profiles: profiles?.length ?? 0,
    });
  }

  const sectionName = area?.name ?? null;
  const assignedBy = actor?.full_name ?? "A colleague";
  const href = `/workspace/internal/${taskId}`;

  // Bell rows first — these must survive a Resend outage. This is a single
  // multi-row insert, so it is atomic across recipients: one bad row (e.g. an
  // assignee id with no matching profile) fails the whole statement and every
  // recipient loses their bell row, so we must not report success if it fails.
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
    const reason = "RESEND_API_KEY is not configured";
    console.error("[notify-task-assigned]", reason);
    return { ok: false, reason };
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
      .filter((profile): profile is typeof profile & { email: string } =>
        Boolean(profile.email),
      )
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
  if (failed && !failed.ok) {
    console.error("[notify-task-assigned] email send failed", failed.error);
    return { ok: false, reason: failed.error };
  }

  if (insertError) return { ok: false, reason: insertError.message };
  return { ok: true };
}
