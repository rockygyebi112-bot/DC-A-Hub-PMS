import "server-only";
import { createClient } from "@/lib/supabase/server";
import { throwIfError } from "@/lib/supabase/errors";

export async function listClients(opts: { includeArchived?: boolean } = {}) {
  const sb = await createClient();
  const q = sb
    .from("clients")
    .select(
      "id, name, contact_email, logo_url, archived_at, created_at, projects(id, archived_at)",
    )
    .order("name", { ascending: true });
  if (!opts.includeArchived) q.is("archived_at", null);
  const { data, error } = await q;
  throwIfError(error);
  return (data ?? []).map((c) => {
    const projects = (c.projects ?? []) as { id: string; archived_at: string | null }[];
    const projectCount = projects.filter((p) => p.archived_at === null).length;
    const rest = {
      id: c.id,
      name: c.name,
      contact_email: c.contact_email,
      logo_url: c.logo_url,
      archived_at: c.archived_at,
      created_at: c.created_at,
    };
    return { ...rest, project_count: projectCount };
  });
}

export async function getClient(id: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("clients")
    .select("id, name, contact_email, logo_url, archived_at")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export type ClientProjectRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  archived_at: string | null;
  start_date: string | null;
  end_date: string | null;
  doneCount: number;
  totalCount: number;
};

export async function listClientProjects(clientId: string): Promise<ClientProjectRow[]> {
  const sb = await createClient();
  const { data: projects, error } = await sb
    .from("projects")
    .select("id, name, code, status, archived_at, start_date, end_date")
    .eq("client_id", clientId)
    .order("name", { ascending: true });
  throwIfError(error);
  if (!projects?.length) return [];

  const projectIds = projects.map((project) => project.id);
  const { data: phases } = await sb
    .from("phases")
    .select("id, project_id")
    .in("project_id", projectIds);
  const phaseIds = (phases ?? []).map((phase) => phase.id);
  const { data: activities } = phaseIds.length
    ? await sb.from("activities").select("id, phase_id, status").in("phase_id", phaseIds)
    : { data: [] };

  const phaseToProject = new Map((phases ?? []).map((phase) => [phase.id, phase.project_id]));
  const counts = new Map<string, { done: number; total: number }>();
  for (const activity of activities ?? []) {
    const projectId = phaseToProject.get(activity.phase_id);
    if (!projectId) continue;
    const current = counts.get(projectId) ?? { done: 0, total: 0 };
    current.total += 1;
    if (activity.status === "done") current.done += 1;
    counts.set(projectId, current);
  }

  return projects.map((project) => {
    const count = counts.get(project.id) ?? { done: 0, total: 0 };
    return {
      ...project,
      doneCount: count.done,
      totalCount: count.total,
    };
  });
}

const PROJECT_SORT_COLUMNS = [
  "name",
  "status",
  "start_date",
  "created_at",
  "client_id",
] as const;
export type ProjectSortColumn = (typeof PROJECT_SORT_COLUMNS)[number];

export function isProjectSortColumn(value: unknown): value is ProjectSortColumn {
  return (
    typeof value === "string" &&
    (PROJECT_SORT_COLUMNS as readonly string[]).includes(value)
  );
}

export async function listProjects(
  opts: {
    includeArchived?: boolean;
    sort?: string;
    dir?: "asc" | "desc";
  } = {},
) {
  const sb = await createClient();
  // Allowlist sort column to prevent injection. Fall back to name asc.
  const sortColumn: ProjectSortColumn = isProjectSortColumn(opts.sort)
    ? opts.sort
    : "name";
  const ascending = opts.dir !== "desc";

  const q = sb
    .from("projects")
    .select(
      "id, name, code, status, archived_at, start_date, end_date, created_at, client:clients(id, name)",
    )
    .order(sortColumn, { ascending });
  if (!opts.includeArchived) q.is("archived_at", null);
  const { data, error } = await q;
  throwIfError(error);
  return data ?? [];
}

export async function getProject(id: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("projects")
    .select(
      "id, name, code, status, description, start_date, end_date, archived_at, client_id, created_at, updated_at, client:clients(id, name)",
    )
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function listUsers(opts: { includeInactive?: boolean } = {}) {
  const sb = await createClient();
  const q = sb
    .from("profiles")
    .select("id, user_id, full_name, email, role, is_active, created_at")
    .order("full_name", { ascending: true });
  if (!opts.includeInactive) q.eq("is_active", true);
  const { data, error } = await q;
  throwIfError(error);
  return data ?? [];
}

export async function getUserByProfileId(id: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("profiles")
    .select("id, user_id, full_name, email, role, is_active")
    .eq("id", id)
    .single();
  throwIfError(error);
  return data;
}

export type ProjectMemberRow = {
  id: string;
  project_role: "member" | "viewer";
  user_id: string;
  profile:
    | {
        id: string;
        full_name: string;
        email: string;
        role: "admin" | "staff" | "client";
      }
    | undefined;
};

export async function listProjectMembers(
  projectId: string,
): Promise<ProjectMemberRow[]> {
  const sb = await createClient();
  const { data: rows, error } = await sb
    .from("project_members")
    .select("id, project_role, user_id")
    .eq("project_id", projectId);
  throwIfError(error);
  if (!rows || rows.length === 0) return [];
  const ids = rows.map((r) => r.user_id);
  const { data: profiles, error: pe } = await sb
    .from("profiles")
    .select("id, user_id, full_name, email, role")
    .in("user_id", ids);
  throwIfError(pe);
  const byUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return rows.map((r) => {
    const p = byUserId.get(r.user_id);
    return {
      id: r.id,
      project_role: r.project_role as "member" | "viewer",
      user_id: r.user_id,
      profile: p
        ? {
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            role: p.role as "admin" | "staff" | "client",
          }
        : undefined,
    };
  });
}

export async function listAssignableUsers(
  projectId: string,
  forRole: "staff" | "client",
) {
  const sb = await createClient();
  const targetRoles = forRole === "staff" ? ["staff", "admin"] : ["client"];

  const { data: existing } = await sb
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);
  const taken = new Set((existing ?? []).map((r) => r.user_id));

  const { data, error } = await sb
    .from("profiles")
    .select("id, user_id, full_name, email, role")
    .in("role", targetRoles)
    .eq("is_active", true);
  throwIfError(error);
  return (data ?? []).filter((p) => !taken.has(p.user_id));
}

export type AdminCounts = {
  activeClients: number;
  activeProjects: number;
  totalUsers: number;
  pendingInvites: number;
  deltas: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    pausedProjects: number;
    totalUsers: number;
  };
};

export function computeDelta(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function getAdminCounts(): Promise<AdminCounts> {
  const sb = await createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    clientsRes,
    projectsRes,
    usersRes,
    invitesRes,
    // Current totals (active = not archived) by status
    totalProjectsCurrentRes,
    activeProjectsCurrentRes,
    completedProjectsCurrentRes,
    pausedProjectsCurrentRes,
    totalUsersCurrentRes,
    // Snapshot 30 days ago (rows that existed then)
    totalProjectsPrevRes,
    activeProjectsPrevRes,
    completedProjectsPrevRes,
    pausedProjectsPrevRes,
    totalUsersPrevRes,
  ] = await Promise.all([
    sb.from("clients").select("*", { count: "exact", head: true }).is("archived_at", null),
    sb.from("projects").select("*", { count: "exact", head: true }).is("archived_at", null),
    sb.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
    sb
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
    sb.from("projects").select("*", { count: "exact", head: true }).is("archived_at", null),
    sb
      .from("projects")
      .select("*", { count: "exact", head: true })
      .is("archived_at", null)
      .eq("status", "active"),
    sb
      .from("projects")
      .select("*", { count: "exact", head: true })
      .is("archived_at", null)
      .eq("status", "completed"),
    sb
      .from("projects")
      .select("*", { count: "exact", head: true })
      .is("archived_at", null)
      .eq("status", "paused"),
    sb.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
    sb
      .from("projects")
      .select("*", { count: "exact", head: true })
      .lt("created_at", thirtyDaysAgo),
    sb
      .from("projects")
      .select("*", { count: "exact", head: true })
      .lt("created_at", thirtyDaysAgo)
      .eq("status", "active"),
    sb
      .from("projects")
      .select("*", { count: "exact", head: true })
      .lt("created_at", thirtyDaysAgo)
      .eq("status", "completed"),
    sb
      .from("projects")
      .select("*", { count: "exact", head: true })
      .lt("created_at", thirtyDaysAgo)
      .eq("status", "paused"),
    sb
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .lt("created_at", thirtyDaysAgo),
  ]);

  const totalProjectsCurrent = totalProjectsCurrentRes.count ?? 0;
  const activeProjectsCurrent = activeProjectsCurrentRes.count ?? 0;
  const completedProjectsCurrent = completedProjectsCurrentRes.count ?? 0;
  const pausedProjectsCurrent = pausedProjectsCurrentRes.count ?? 0;
  const totalUsersCurrent = totalUsersCurrentRes.count ?? 0;

  return {
    activeClients: clientsRes.count ?? 0,
    activeProjects: projectsRes.count ?? 0,
    totalUsers: usersRes.count ?? 0,
    pendingInvites: invitesRes.count ?? 0,
    deltas: {
      totalProjects: computeDelta(totalProjectsCurrent, totalProjectsPrevRes.count ?? 0),
      activeProjects: computeDelta(activeProjectsCurrent, activeProjectsPrevRes.count ?? 0),
      completedProjects: computeDelta(
        completedProjectsCurrent,
        completedProjectsPrevRes.count ?? 0,
      ),
      pausedProjects: computeDelta(pausedProjectsCurrent, pausedProjectsPrevRes.count ?? 0),
      totalUsers: computeDelta(totalUsersCurrent, totalUsersPrevRes.count ?? 0),
    },
  };
}

export async function listRecentProjects(limit = 5) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("projects")
    .select("id, name, code, status, created_at")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return data ?? [];
}
