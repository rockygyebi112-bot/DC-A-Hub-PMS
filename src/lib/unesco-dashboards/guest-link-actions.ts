"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email/send";
import { createServiceClient } from "@/lib/supabase/server";
import { isUnescoDashboardSlug, unescoDashboards, type UnescoDashboardSlug } from "./routes";
import { getUnescoDashboardAccess } from "./access";
import { getActiveInvitation, guestCookie, guestTokenPattern, hashGuestLink, invitationIdPattern } from "./guest-links";

const emailSchema = z.string().trim().toLowerCase().max(254).email();

async function deliver(email: string, path: string, verification: boolean, slug: UnescoDashboardSlug) {
  const url = new URL(path, getAppUrl()).href;
  const title = unescoDashboards[slug].title;
  const message = verification
    ? `Use this one-time link to verify your email and open ${title}. It expires in 15 minutes.`
    : `You were invited to view the UNESCO ${title} dashboard. Open the link to confirm access in your browser. The link expires in 15 minutes, and you can request a fresh link from the same page.`;
  try {
    const result = await sendEmail({
      to: email,
      subject: verification ? `Verify your ${title} dashboard access` : `Invitation to the UNESCO ${title} dashboard`,
      category: "dashboard_invitation",
      text: `${message}\n\n${url}`,
      html: `<p>${message}</p><p><a href="${url}">Open ${title}</a></p>`,
    });
    return result.ok;
  } catch {
    return false;
  }
}

export async function inviteDashboardGuest(projectId: string, slug: UnescoDashboardSlug, emailInput: string) {
  const access = await getUnescoDashboardAccess(projectId);
  if (!isUnescoDashboardSlug(slug) || access.status !== "member" || access.projectRole !== "manager") {
    return { error: "Only UNESCO project managers can invite guests." };
  }
  const email = emailSchema.safeParse(emailInput);
  if (!email.success) return { error: "Enter a valid email address." };

  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const sb = createServiceClient();
  const { data, error } = await sb.from("unesco_dashboard_guest_links").upsert({
    project_id: projectId,
    dashboard_slug: slug,
    created_by: access.userId,
    email: email.data,
    expires_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
    session_hash: null,
    challenge_hash: hashGuestLink(token),
    challenge_expires_at: new Date(now + 15 * 60 * 1000).toISOString(),
  }, { onConflict: "project_id,dashboard_slug,email" }).select("id, email, expires_at").single();
  if (error || !data) return { error: "The invitation could not be created." };
  const sent = await deliver(data.email, `/share/dashboards/${data.id}?verify=${token}`, false, slug);
  return { invitation: data, sent };
}

export async function revokeDashboardGuest(projectId: string, slug: UnescoDashboardSlug, id: string) {
  const access = await getUnescoDashboardAccess(projectId);
  if (!isUnescoDashboardSlug(slug) || access.status !== "member" || access.projectRole !== "manager" || !invitationIdPattern.test(id)) {
    return { error: "You do not have permission to revoke this invitation." };
  }
  const { error } = await createServiceClient().from("unesco_dashboard_guest_links").delete()
    .eq("project_id", projectId).eq("dashboard_slug", slug).eq("id", id);
  return error ? { error: "The invitation could not be revoked." } : { ok: true };
}

export async function requestDashboardGuestVerification(id: string) {
  const invitation = await getActiveInvitation(id);
  if (!invitation) return;
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const hash = hashGuestLink(token);
  const sb = createServiceClient();
  // A challenge lasts 15 minutes and can be replaced after the first minute.
  const retryBefore = new Date(now + 14 * 60 * 1000).toISOString();
  const { data } = await sb.from("unesco_dashboard_guest_links")
    .update({ challenge_hash: hash, challenge_expires_at: new Date(now + 15 * 60 * 1000).toISOString() })
    .eq("id", id)
    .gt("expires_at", new Date(now).toISOString())
    .or(`challenge_expires_at.is.null,challenge_expires_at.lte.${retryBefore}`)
    .select("id").maybeSingle();
  if (!data) return;
  if (!(await deliver(invitation.email, `/share/dashboards/${id}?verify=${token}`, true, invitation.dashboard_slug))) {
    await sb.from("unesco_dashboard_guest_links").update({ challenge_hash: null, challenge_expires_at: null })
      .eq("id", id).eq("challenge_hash", hash);
  }
}

export async function verifyDashboardGuest(id: string, token: string) {
  if (!invitationIdPattern.test(id) || !guestTokenPattern.test(token)) return false;
  const projectId = process.env.UNESCO_PROJECT_ID;
  if (!projectId) return false;
  const session = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const { data, error } = await createServiceClient().from("unesco_dashboard_guest_links")
    .update({ challenge_hash: null, challenge_expires_at: null, session_hash: hashGuestLink(session) })
    .eq("id", id)
    .eq("project_id", projectId)
    .eq("challenge_hash", hashGuestLink(token))
    .gt("challenge_expires_at", now)
    .gt("expires_at", now)
    .select("expires_at").maybeSingle();
  if (error || !data) return false;
  (await cookies()).set(guestCookie(id), session, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", expires: new Date(data.expires_at),
  });
  redirect(`/share/dashboards/${id}`);
}
