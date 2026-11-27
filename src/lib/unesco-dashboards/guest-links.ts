import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { isUnescoDashboardSlug, type UnescoDashboardSlug } from "./routes";
import { isUnescoProject } from "./access";

export function guestCookie(id: string) {
  return `unesco-dashboard-guest-${id}`;
}
export const invitationIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
export const guestTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function hashGuestLink(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getActiveInvitation(id: string) {
  if (!invitationIdPattern.test(id)) return null;
  const { data, error } = await createServiceClient()
    .from("unesco_dashboard_guest_links")
    .select("id, project_id, dashboard_slug, email, expires_at, session_hash")
    .eq("id", id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data || !isUnescoProject(data.project_id) || !isUnescoDashboardSlug(data.dashboard_slug)) return null;
  return { ...data, dashboard_slug: data.dashboard_slug };
}

export async function matchesGuestSession(id: string, sessionHash: string | null) {
  const token = (await cookies()).get(guestCookie(id))?.value;
  return !!(sessionHash && token && guestTokenPattern.test(token) && hashGuestLink(token) === sessionHash);
}

export async function getGuestDashboardProject(invitationId: string, slug: UnescoDashboardSlug) {
  const invitation = await getActiveInvitation(invitationId);
  return invitation?.dashboard_slug === slug && await matchesGuestSession(invitationId, invitation.session_hash) ? invitation.project_id : null;
}
