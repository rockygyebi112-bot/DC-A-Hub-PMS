import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";

export async function notifyClientViewersActivityDone({
  projectId,
  activityId,
}: {
  projectId: string;
  activityId: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "RESEND_API_KEY is not configured" };

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
  const recipients = (profiles ?? []).map((profile) => profile.email).filter(Boolean);
  if (recipients.length === 0) return { ok: true };

  const portalUrl = `${getAppUrl()}/portal/projects/${projectId}/activities/${activityId}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? "DC&A Hub PMS <onboarding@resend.dev>",
      to: recipients,
      subject: `[${project.name}] New activity completed: ${activity.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
          <h2>${activity.name}</h2>
          <p><strong>Project:</strong> ${project.name}</p>
          <p><strong>Completed:</strong> ${activity.completed_date ?? "Today"}</p>
          <p>${activity.narrative_note ?? "A project activity has been marked complete."}</p>
          <p><a href="${portalUrl}">Open activity document</a></p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    return { ok: false, reason: await response.text() };
  }

  return { ok: true };
}

