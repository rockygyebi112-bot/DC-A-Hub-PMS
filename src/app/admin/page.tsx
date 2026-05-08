import Link from "next/link";
import {
  Activity,
  Building2,
  FolderKanban,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatCard } from "@/components/admin/ui/stat-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { getAdminCounts, listRecentProjects } from "@/lib/admin/queries";
import { createClient } from "@/lib/supabase/server";

type FeedEntry = {
  id: string;
  action: string;
  created_at: string;
  projectName: string | null;
  actorName: string | null;
};

async function listRecentActivity(): Promise<FeedEntry[]> {
  const sb = await createClient();
  const { data: rows } = await sb
    .from("activity_log")
    .select("id, action, created_at, project_id, actor_user_id")
    .order("created_at", { ascending: false })
    .limit(8);

  if (!rows?.length) return [];

  const projectIds = Array.from(new Set(rows.map((r) => r.project_id).filter(Boolean)));
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_user_id).filter(Boolean) as string[]),
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
  const actorById = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p.full_name]));

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    created_at: r.created_at,
    projectName: r.project_id ? projectById.get(r.project_id) ?? null : null,
    actorName: r.actor_user_id ? actorById.get(r.actor_user_id) ?? null : null,
  }));
}

export default async function AdminOverview() {
  const [counts, recentProjects, activity] = await Promise.all([
    getAdminCounts(),
    listRecentProjects(6),
    listRecentActivity(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle="A fast read on clients, projects, people, and recent motion."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/admin/clients/new" />}>
              <Plus className="size-4" />
              Client
            </Button>
            <Button render={<Link href="/admin/projects/new" />}>
              <Plus className="size-4" />
              Project
            </Button>
          </div>
        }
      />

      <section className="rounded-[var(--admin-card-radius)] border bg-card px-5 py-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              Admin command center
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Keep delivery work tidy before Plan 3 adds the workspace flow.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Create project shells, keep client records clean, and make sure the right
                people are ready before activity tracking goes live.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Link
              href="/admin/users"
              className="rounded-lg border bg-background p-3 transition-colors hover:bg-accent"
            >
              <Users className="mb-2 size-4 text-primary" />
              <span className="font-medium">Review access</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Roles and active seats
              </span>
            </Link>
            <Link
              href="/admin/projects"
              className="rounded-lg border bg-background p-3 transition-colors hover:bg-accent"
            >
              <FolderKanban className="mb-2 size-4 text-primary" />
              <span className="font-medium">Project roster</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Status and teams
              </span>
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active clients"
          value={counts.activeClients}
          href="/admin/clients"
          hint="Organizations visible to admins"
          icon={Building2}
        />
        <StatCard
          label="Active projects"
          value={counts.activeProjects}
          href="/admin/projects"
          hint="Open delivery work"
          icon={FolderKanban}
        />
        <StatCard
          label="Active users"
          value={counts.totalUsers}
          href="/admin/users"
          hint="Enabled profiles"
          icon={Users}
        />
        <StatCard
          label="New profiles"
          value={counts.pendingInvites}
          href="/admin/users"
          hint="Created in the last 7 days"
          icon={Activity}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          title="Recent projects"
          description="Newest active project shells."
          action={
            <Button variant="ghost" size="sm" render={<Link href="/admin/projects" />}>
              View all
            </Button>
          }
        >
          {recentProjects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Create the first project shell when the client is ready."
              icon={FolderKanban}
            />
          ) : (
            <div className="space-y-2">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/admin/projects/${project.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">{project.code}</p>
                  </div>
                  <StatusPill
                    status={project.status as "planning" | "active" | "paused" | "completed"}
                  />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Recent activity"
          description="Latest project events recorded by the system."
          action={<Activity className="size-4 text-muted-foreground" />}
        >
          {activity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Activity will appear here as workspace actions begin."
              icon={Activity}
            />
          ) : (
            <ol className="space-y-3">
              {activity.map((row) => (
                <li key={row.id} className="flex gap-3 text-sm">
                  <span className="mt-1 size-2 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.action}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.projectName ?? "Project"} by {row.actorName ?? "system"}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString()}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>

        <SectionCard title="Quick actions" description="Common admin moves.">
          <div className="grid gap-2">
            <Button variant="outline" render={<Link href="/admin/clients/new" />}>
              <Plus className="size-4" />
              New client
            </Button>
            <Button variant="outline" render={<Link href="/admin/projects/new" />}>
              <Plus className="size-4" />
              New project
            </Button>
            <Button variant="outline" render={<Link href="/admin/users" />}>
              <Users className="size-4" />
              Invite user
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
