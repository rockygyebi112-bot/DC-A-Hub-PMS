import "server-only";
import { cache as reactCache } from "react";
import { createClient } from "@/lib/supabase/server";
import { throwIfError } from "@/lib/supabase/errors";
import {
  PROFILE_PUBLIC,
  PROFILE_PUBLIC_WITH_STATUS,
  PROFILE_PUBLIC_WITH_STATUS_AND_CREATED,
  PROJECT_ACTIVITY_COUNTS,
} from "@/lib/supabase/columns";

// Reserved Postgres LIKE/ILIKE wildcards. Escape before interpolating any
// attacker-controlled value into an `.ilike(...)` or `.or(...)` filter so
// users can't broaden the pattern (`%`/`_`) or break out of it (`\`).
function escapeLike(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}

/**
 * Shared pagination options surfaced by every admin list query. Keep these
 * unset to preserve the legacy "load everything" shape; pages that scale to
 * thousands of rows pass `{ limit, offset }` to cap the wire payload.
 */
export type PaginationOptions = {
  limit?: number;
  offset?: number;
};

export async function listClients(
  opts: { includeArchived?: boolean; search?: string } & PaginationOptions = {},
) {
  const sb = await createClient();
  const q = sb
    .from("clients")
    .select(
      "id, name, contact_email, logo_url, archived_at, created_at, projects(id, archived_at)",
    )
    .order("name", { ascending: true });
  if (!opts.includeArchived) q.is("archived_at", null);
  if (opts.search?.trim()) q.ilike("name", `%${escapeLike(opts.search.trim())}%`);
  if (opts.limit && opts.limit > 0) {
    const offset = opts.offset ?? 0;
    q.range(offset, offset + opts.limit - 1);
  }
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

export const getClient = reactCache(async (id: string) => {
  const sb = await createClient();
  const { data, error } = await sb
    .from("clients")
    .select("id, name, contact_email, logo_url, archived_at")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return data;
});

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

export const listClientProjects = reactCache(
  async (
    clientId: string,
    opts: PaginationOptions = {},
  ): Promise<ClientProjectRow[]> => {
    const sb = await createClient();
    // Two cheap queries instead of one big nested join. The prior version
    // pulled every activity row under the client just to compute done/total
    // counts in JS; `project_activity_counts` does that arithmetic in
    // Postgres and returns one scalar row per project.
    const projectsQuery = sb
      .from("projects")
      .select(
        "id, name, code, status, archived_at, start_date, end_date",
      )
      .eq("client_id", clientId)
      .order("name", { ascending: true });
    if (opts.limit && opts.limit > 0) {
      const offset = opts.offset ?? 0;
      projectsQuery.range(offset, offset + opts.limit - 1);
    }
    const { data: projects, error } = await projectsQuery;
    throwIfError(error);
    if (!projects?.length) return [];

    const projectIds = projects.map((p) => p.id);
    const { data: countsRaw } = await sb
      .from("project_activity_counts")
      .select(PROJECT_ACTIVITY_COUNTS)
      .in("project_id", projectIds);

    const countsById = new Map<
      string,
      { total_count: number | null; done_count: number | null }
    >();
    for (const row of countsRaw ?? []) {
      countsById.set(row.project_id, row);
    }

    return projects.map((project) => {
      const counts = countsById.get(project.id);
      return {
        ...project,
        doneCount: Number(counts?.done_count ?? 0),
        totalCount: Number(counts?.total_count ?? 0),
      };
    });
  },
);

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
    /** Server-side ILIKE on name + code. Skip to fetch everything. */
    search?: string;
  } & PaginationOptions = {},
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
  if (opts.search?.trim()) {
    // `.or(...)` takes a comma-separated PostgREST filter expression, so the
    // escaped term goes inline. escapeLike() already neutralised %/_/\, and
    // PostgREST quotes the value, so injection via `,` / `)` is contained.
    const term = escapeLike(opts.search.trim());
    q.or(`name.ilike.%${term}%,code.ilike.%${term}%`);
  }
  if (opts.limit && opts.limit > 0) {
    const offset = opts.offset ?? 0;
    q.range(offset, offset + opts.limit - 1);
  }
  const { data, error } = await q;
  throwIfError(error);
  return data ?? [];
}

export const getProject = reactCache(async (id: string) => {
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
});

export async function listUsers(
  opts: { includeInactive?: boolean; search?: string } & PaginationOptions = {},
) {
  const sb = await createClient();
  const q = sb
    .from("profiles")
    .select(PROFILE_PUBLIC_WITH_STATUS_AND_CREATED)
    .order("full_name", { ascending: true });
  if (!opts.includeInactive) q.eq("is_active", true);
  if (opts.search?.trim()) {
    const term = escapeLike(opts.search.trim());
    q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  if (opts.limit && opts.limit > 0) {
    const offset = opts.offset ?? 0;
    q.range(offset, offset + opts.limit - 1);
  }
  const { data, error } = await q;
  throwIfError(error);
  return data ?? [];
}

export async function getUserByProfileId(id: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("profiles")
    .select(PROFILE_PUBLIC_WITH_STATUS)
    .eq("id", id)
    .single();
  throwIfError(error);
  return data;
}

export type ProjectMemberRow = {
  id: string;
  project_role: "manager" | "member" | "viewer";
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
    .select(PROFILE_PUBLIC)
    .in("user_id", ids);
  throwIfError(pe);
  const byUserId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return rows.map((r) => {
    const p = byUserId.get(r.user_id);
    return {
      id: r.id,
      project_role: r.project_role as "manager" | "member" | "viewer",
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
    .select(PROFILE_PUBLIC)
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

type AdminCountsRpcRow = {
  active_clients: number;
  active_projects: number;
  total_users: number;
  pending_invites: number;
  total_projects_current: number;
  active_projects_current: number;
  completed_projects_current: number;
  paused_projects_current: number;
  total_users_current: number;
  total_projects_prev: number;
  active_projects_prev: number;
  completed_projects_prev: number;
  paused_projects_prev: number;
  total_users_prev: number;
};

// React.cache so layout + page (both server components in the same render
// pass) share a single RPC response instead of issuing it twice.
export const getAdminCounts = reactCache(async (): Promise<AdminCounts> => {
  const sb = await createClient();
  // Single Postgres function call replaces 14 separate `count: exact` HTTP
  // round-trips. The function aggregates everything in one scan per table
  // using `count(*) FILTER (...)` and is locked down to admins via
  // `security definer` + an `is_admin()` check. Cast to `any` because the
  // generated supabase-js types don't yet know about `admin_counts`; run
  // `npm run db:types` after the migration is applied to refresh them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)("admin_counts");
  throwIfError(error);
  // RPC returns a one-row TABLE, surfaced as an array by supabase-js.
  const row = (Array.isArray(data) ? data[0] : data) as AdminCountsRpcRow | null;
  const safe = (n: unknown) => (typeof n === "number" ? n : Number(n ?? 0));

  if (!row) {
    return {
      activeClients: 0,
      activeProjects: 0,
      totalUsers: 0,
      pendingInvites: 0,
      deltas: {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        pausedProjects: 0,
        totalUsers: 0,
      },
    };
  }

  return {
    activeClients: safe(row.active_clients),
    activeProjects: safe(row.active_projects),
    totalUsers: safe(row.total_users),
    pendingInvites: safe(row.pending_invites),
    deltas: {
      totalProjects: computeDelta(
        safe(row.total_projects_current),
        safe(row.total_projects_prev),
      ),
      activeProjects: computeDelta(
        safe(row.active_projects_current),
        safe(row.active_projects_prev),
      ),
      completedProjects: computeDelta(
        safe(row.completed_projects_current),
        safe(row.completed_projects_prev),
      ),
      pausedProjects: computeDelta(
        safe(row.paused_projects_current),
        safe(row.paused_projects_prev),
      ),
      totalUsers: computeDelta(safe(row.total_users_current), safe(row.total_users_prev)),
    },
  };
});

/**
 * Per-request memoized loader for the admin shell. Bundles counts, the
 * client + project lists used by the sidebar/search, and the overdue
 * activity count for the greeting subtitle.
 *
 * NOTE: This was previously wrapped in `unstable_cache`, but every call
 * here ultimately goes through `createClient()` which reads `cookies()`
 * for per-user RLS — that's not allowed inside `unstable_cache` (Next 15+)
 * and would have produced incorrect results across users anyway. We use
 * React's `cache()` for per-request deduplication only.
 */
export type AdminProjectRow = Awaited<ReturnType<typeof listProjects>>[number];
export type AdminClientRow = Awaited<ReturnType<typeof listClients>>[number];

export type AdminLayoutData = {
  counts: AdminCounts;
  clients: AdminClientRow[];
  projects: AdminProjectRow[];
  overdueCount: number;
};

export const getAdminLayoutData = reactCache(
  async (_userId: string): Promise<AdminLayoutData> => {
    const today = new Date().toISOString().slice(0, 10);
    const sb = await createClient();
    const [counts, clients, projects, overdueRes] = await Promise.all([
      getAdminCounts(),
      listClients().catch(() => [] as AdminClientRow[]),
      listProjects().catch(() => [] as AdminProjectRow[]),
      sb
        .from("activities")
        .select("id", { count: "exact", head: true })
        .lt("planned_date", today)
        .neq("status", "done"),
    ]);
    return {
      counts,
      clients,
      projects,
      overdueCount: overdueRes.count ?? 0,
    };
  },
);
