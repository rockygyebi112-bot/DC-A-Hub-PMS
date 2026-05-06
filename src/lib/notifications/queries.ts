import { createClient } from "@/lib/supabase/client";
import type { NotificationItem, NotificationsBucket } from "./types";

interface ActivityRow {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  updated_at: string;
  project: { name: string; slug: string } | null;
}

interface UpdateRow {
  id: string;
  note: string;
  status_before: string | null;
  status_after: string | null;
  user_id: string;
  created_at: string;
  activity: {
    id: string;
    title: string;
    owner_user_id: string | null;
    project: { name: string; slug: string } | null;
  } | null;
}

function todayIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    .toISOString()
    .slice(0, 10);
}

function plusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    .toISOString()
    .slice(0, 10);
}

export async function fetchNotifications(
  userId: string,
): Promise<NotificationsBucket> {
  const supabase = createClient();
  const today = todayIso();
  const inAWeek = plusDaysIso(7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const overdueQ = supabase
    .from("project_activities")
    .select("id, title, due_date, status, updated_at, project:projects(name, slug)")
    .eq("owner_user_id", userId)
    .neq("status", "done")
    .not("due_date", "is", null)
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(20);

  const dueSoonQ = supabase
    .from("project_activities")
    .select("id, title, due_date, status, updated_at, project:projects(name, slug)")
    .eq("owner_user_id", userId)
    .neq("status", "done")
    .not("due_date", "is", null)
    .gte("due_date", today)
    .lte("due_date", inAWeek)
    .order("due_date", { ascending: true })
    .limit(20);

  const updatesQ = supabase
    .from("project_activity_updates")
    .select(
      "id, note, status_before, status_after, user_id, created_at, activity:project_activities(id, title, owner_user_id, project:projects(name, slug))",
    )
    .gte("created_at", fourteenDaysAgo.toISOString())
    .neq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  const [overdueRes, dueSoonRes, updatesRes] = await Promise.all([
    overdueQ,
    dueSoonQ,
    updatesQ,
  ]);

  const overdueRows = (overdueRes.data ?? []) as unknown as ActivityRow[];
  const dueSoonRows = (dueSoonRes.data ?? []) as unknown as ActivityRow[];
  const updateRows = (updatesRes.data ?? []) as unknown as UpdateRow[];

  const toActivityItem =
    (kind: "overdue" | "due_soon") =>
    (a: ActivityRow): NotificationItem => {
      const due = a.due_date
        ? new Date(a.due_date).toLocaleDateString()
        : "no date";
      return {
        id: `${kind}:${a.id}`,
        kind,
        title: a.title,
        detail:
          kind === "overdue"
            ? `Overdue · ${a.project?.name ?? "Unknown project"} · was due ${due}`
            : `Due ${due} · ${a.project?.name ?? "Unknown project"}`,
        href: a.project ? `/projects/${a.project.slug}` : "/projects",
        timestamp: a.updated_at,
      };
    };

  const recentUpdates: NotificationItem[] = updateRows
    .filter((u) => u.activity && u.activity.owner_user_id === userId)
    .map((u) => {
      const transition =
        u.status_before && u.status_after && u.status_before !== u.status_after
          ? ` (${u.status_before} → ${u.status_after})`
          : "";
      return {
        id: `update:${u.id}`,
        kind: "update" as const,
        title: u.activity?.title ?? "Activity",
        detail: `${u.activity?.project?.name ?? "Project"} · update posted${transition}`,
        href: u.activity?.project
          ? `/projects/${u.activity.project.slug}`
          : "/projects",
        timestamp: u.created_at,
      };
    });

  return {
    overdue: overdueRows.map(toActivityItem("overdue")),
    dueSoon: dueSoonRows.map(toActivityItem("due_soon")),
    recentUpdates,
  };
}

export function unreadCount(
  bucket: NotificationsBucket,
  lastSeenIso: string | null,
): number {
  const all = [...bucket.overdue, ...bucket.dueSoon, ...bucket.recentUpdates];
  // Overdue is always considered unread (it's a current state, not a moment).
  // Due-soon and updates are unread only when newer than lastSeenAt.
  if (!lastSeenIso) return all.length;
  const since = new Date(lastSeenIso).getTime();
  return (
    bucket.overdue.length +
    bucket.dueSoon.filter((n) => new Date(n.timestamp).getTime() > since)
      .length +
    bucket.recentUpdates.filter((n) => new Date(n.timestamp).getTime() > since)
      .length
  );
}
