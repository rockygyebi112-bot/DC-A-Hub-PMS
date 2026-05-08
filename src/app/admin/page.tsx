import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";

type FeedEntry = {
  id: string;
  action: string;
  created_at: string;
  projectName: string | null;
  actorName: string | null;
};

async function getStats() {
  const sb = await createClient();
  const [activeProjectsRes, activeUsersRes, activeClientsRes, logRes] =
    await Promise.all([
      sb
        .from("projects")
        .select("*", { count: "exact", head: true })
        .is("archived_at", null)
        .neq("status", "completed"),
      sb
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      sb
        .from("clients")
        .select("*", { count: "exact", head: true })
        .is("archived_at", null),
      sb
        .from("activity_log")
        .select("id, action, created_at, project_id, actor_user_id")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const logRows = logRes.data ?? [];
  let log: FeedEntry[] = [];
  if (logRows.length > 0) {
    const projectIds = Array.from(new Set(logRows.map((r) => r.project_id).filter(Boolean)));
    const actorIds = Array.from(
      new Set(logRows.map((r) => r.actor_user_id).filter(Boolean) as string[]),
    );
    const [projectsRes, profilesRes] = await Promise.all([
      projectIds.length
        ? sb.from("projects").select("id, name").in("id", projectIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      actorIds.length
        ? sb.from("profiles").select("user_id, full_name").in("user_id", actorIds)
        : Promise.resolve({ data: [] as { user_id: string; full_name: string }[] }),
    ]);
    const projectById = new Map((projectsRes.data ?? []).map((p) => [p.id, p.name]));
    const actorByUserId = new Map(
      (profilesRes.data ?? []).map((p) => [p.user_id, p.full_name]),
    );
    log = logRows.map((r) => ({
      id: r.id,
      action: r.action,
      created_at: r.created_at,
      projectName: r.project_id ? projectById.get(r.project_id) ?? null : null,
      actorName: r.actor_user_id ? actorByUserId.get(r.actor_user_id) ?? null : null,
    }));
  }

  return {
    activeProjects: activeProjectsRes.count ?? 0,
    activeUsers: activeUsersRes.count ?? 0,
    activeClients: activeClientsRes.count ?? 0,
    log,
  };
}

export default async function AdminOverview() {
  const stats = await getStats();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.activeProjects}</div>
            <Link
              href="/admin/projects"
              className="text-xs text-muted-foreground hover:underline"
            >
              View all →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.activeUsers}</div>
            <Link
              href="/admin/users"
              className="text-xs text-muted-foreground hover:underline"
            >
              View all →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.activeClients}</div>
            <Link
              href="/admin/clients"
              className="text-xs text-muted-foreground hover:underline"
            >
              View all →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.log.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {stats.log.map((row) => (
                <li key={row.id} className="flex items-center gap-3 text-sm">
                  <Badge variant="outline">{row.action}</Badge>
                  <span className="font-medium">{row.projectName ?? "—"}</span>
                  <span className="text-muted-foreground">
                    by {row.actorName ?? "system"}
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
