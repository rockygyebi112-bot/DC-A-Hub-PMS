import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email/send";
import { renderActivityDoneEmail } from "@/lib/email/templates/activity-done";

export async function notifyClientViewersActivityDone({
  projectId,
  activityId,
}: {
  projectId: string;
  activityId: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, reason: "RESEND_API_KEY is not configured" };
  }

  const admin = createAdminClient();
  const [{ data: project }, { data: activity }, { data: members }] = await Promise.all([
    admin.from("projects").select("id, name").eq("id", projectId).single(),
    admin
      .from("activities")
      .select("id, name, completed_date, narrative_note")
      .eq("id", activityId)
      .single(),
    admin
      .from("project_members")
      .select("user_id")
      .eq("project_id", projectId)
      .eq("project_role", "viewer"),
  ]);

  if (!project || !activity || !members?.length) return { ok: true };

  const { data: profiles } = await admin
    .from("profiles")
    .select("email")
    .in("user_id", members.map((member) => member.user_id));
  const recipients = (profiles ?? [])
    .map((profile) => profile.email)
    .filter((email): email is string => Boolean(email));
  if (recipients.length === 0) return { ok: true };

  const portalUrl = `${getAppUrl()}/portal/projects/${projectId}/activities/${activityId}`;
  const { subject, html, text } = renderActivityDoneEmail({
    projectName: project.name,
    activityName: activity.name,
    completedDate: activity.completed_date ?? null,
    narrativeNote: activity.narrative_note ?? null,
    portalUrl,
  });

  const result = await sendEmail({
    to: recipients,
    subject,
    html,
    text,
    category: "activity_notification",
    // Idempotency keyed on the activity completion: prevents duplicate sends
    // if the server action retries within the 24h key window.
    idempotencyKey: `activity-done/${activityId}`,
    extraTags: [
      { name: "project_id", value: projectId },
      { name: "activity_id", value: activityId },
    ],
  });

  if (!result.ok) return { ok: false, reason: result.error };
  return { ok: true };
}

