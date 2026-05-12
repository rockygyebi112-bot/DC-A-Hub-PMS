import "server-only";

import { createClient } from "@/lib/supabase/server";

export type NotificationEntry = {
  id: string;
  action: string;
  created_at: string;
  project_id: string;
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
  // Comments are noisy — there's no point notifying users about events
  // they themselves triggered. We only suppress this for proof_commented
  // since the existing actions (proof_added, marked_done, started) tend
  // to be staff-driven and useful as a "saved" confirmation.
  const entries = (rows ?? []).filter(
    (row) =>
      !(row.action === "proof_commented" && row.actor_user_id === user.id),
  );
  if (entries.length === 0) {
    return { entries: [], unreadCount: 0, lastReadAt };
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

  const unreadCount = lastReadAt
    ? formatted.filter((e) => e.created_at > lastReadAt).length
    : formatted.length;

  return {
    entries: formatted,
    unreadCount,
    lastReadAt,
  };
}
