import "server-only";

import { createClient } from "@/lib/supabase/server";

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
  /**
   * Free-form metadata recorded at the time of the event. Currently used
   * by 'proof_commented' rows to carry the proof filename and a preview
   * snippet of the comment so the notifications bell can render
   * "Comment on report.pdf: 'Looks great…'" without an extra round-trip.
   */
  meta: Record<string, unknown> | null;
};

export type NotificationFeed = {
  entries: NotificationEntry[];
  unreadCount: number;
  lastReadAt: string | null;
};

const FEED_LIMIT = 20;

// Actions surfaced to client viewers in the portal. Clients should only be
// notified when work actually moves forward or proof is uploaded — not when
// activities are merely created or generically edited.
const PORTAL_VISIBLE_ACTIONS = new Set([
  "started",
  "marked_done",
  "proof_added",
  // Clients should see when the project team replies to their comments
  // (and vice versa). Comments are bidirectional, so the same event shows
  // up for both surfaces.
  "proof_commented",
  "proof_mentioned",
]);

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

export async function getNotificationFeed(
  hrefBase: "portal" | "workspace" = "portal",
): Promise<NotificationFeed> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return { entries: [], unreadCount: 0, lastReadAt: null };
  }

  const baseQuery = sb
    .from("activity_log")
    .select("id, action, created_at, project_id, activity_id, actor_user_id, meta")
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  const filteredQuery =
    hrefBase === "portal"
      ? baseQuery.in("action", Array.from(PORTAL_VISIBLE_ACTIONS))
      : baseQuery;

  const [{ data: rows }, { data: cursor }] = await Promise.all([
    filteredQuery,
    // user_notification_reads is added in migration 0008 and is not yet
    // present in the generated Supabase types — cast to bypass typing.
    (sb as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: { last_read_at: string } | null }>;
          };
        };
      };
    })
      .from("user_notification_reads")
      .select("last_read_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const lastReadAt = cursor?.last_read_at ?? null;
  // Started here (not awaited) so it overlaps the activity_log hydration below,
  // and so the early return further down can still await it.
  const internalEntriesPromise: Promise<NotificationEntry[]> =
    hrefBase === "workspace"
      ? fetchUserNotifications(sb, user.id)
      : Promise.resolve([]);
  // Comments are noisy — there's no point notifying users about events
  // they themselves triggered. We only suppress this for proof_commented
  // since the existing actions (proof_added, marked_done, started) tend
  // to be staff-driven and useful as a "saved" confirmation.
  //
  // We also suppress the broadcast 'proof_commented' row for any user
  // who was @mentioned in that same comment — they already get a
  // targeted 'proof_mentioned' entry and shouldn't see two bell items
  // for one event. mentioned_user_ids is written into meta by
  // addProofComment at the time the broadcast row is inserted.
  const entries = (rows ?? []).filter((row) => {
    if (row.action !== "proof_commented") return true;
    if (row.actor_user_id === user.id) return false;
    const mentioned = (row.meta as { mentioned_user_ids?: unknown } | null)
      ?.mentioned_user_ids;
    if (Array.isArray(mentioned) && mentioned.includes(user.id)) return false;
    return true;
  });
  if (entries.length === 0) {
    const internalOnly = (await internalEntriesPromise).slice(0, FEED_LIMIT);
    const unread = lastReadAt
      ? internalOnly.filter((e) => e.created_at > lastReadAt).length
      : internalOnly.length;
    return { entries: internalOnly, unreadCount: unread, lastReadAt };
  }

  const projectIds = Array.from(new Set(entries.map((row) => row.project_id).filter(Boolean)));
  const activityIds = Array.from(
    new Set(entries.map((row) => row.activity_id).filter(Boolean) as string[]),
  );
  const actorIds = Array.from(
    new Set(entries.map((row) => row.actor_user_id).filter(Boolean) as string[]),
  );

  const [projectsRes, activitiesRes, profilesRes] = await Promise.all([
    projectIds.length
      ? sb.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    activityIds.length
      ? sb.from("activities").select("id, name").in("id", activityIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    actorIds.length
      ? sb.from("profiles").select("user_id, full_name").in("user_id", actorIds)
      : Promise.resolve({ data: [] as { user_id: string; full_name: string }[] }),
  ]);

  const projectById = new Map((projectsRes.data ?? []).map((p) => [p.id, p.name]));
  const activityById = new Map((activitiesRes.data ?? []).map((a) => [a.id, a.name]));
  const actorById = new Map(
    (profilesRes.data ?? []).map((p) => [p.user_id, p.full_name]),
  );

  const formatted: NotificationEntry[] = entries.map((row) => {
    const projectId = row.project_id;
    const activityId = row.activity_id ?? null;
    let href: string | null = null;
    if (projectId) {
      href = activityId
        ? `/${hrefBase}/projects/${projectId}/activities/${activityId}`
        : `/${hrefBase}/projects/${projectId}`;
    }
    return {
      id: row.id,
      source: "activity_log" as const,
      action: row.action,
      created_at: row.created_at,
      project_id: projectId,
      project_name: projectId ? projectById.get(projectId) ?? null : null,
      activity_id: activityId,
      activity_name: activityId ? activityById.get(activityId) ?? null : null,
      actor_name: row.actor_user_id ? actorById.get(row.actor_user_id) ?? null : null,
      href,
      meta:
        (row as { meta?: unknown }).meta &&
        typeof (row as { meta?: unknown }).meta === "object"
          ? ((row as { meta?: Record<string, unknown> }).meta ?? null)
          : null,
    };
  });

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
}

