import "server-only";

import { createClient } from "@/lib/supabase/server";

// Escape Postgres LIKE/ILIKE wildcards so a user-typed query can't pattern-
// match unintended rows (or turn into an expensive scan).
function escapeLike(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}

export type SearchableActivity = {
  id: string;
  name: string;
  project_id: string;
  project_name: string;
  phase_name: string | null;
};

/**
 * Activities the current user can see, flattened into a shape the topbar
 * search can consume. RLS filters out projects the caller has no access to,
 * so this is safe to call from any surface (portal/workspace/admin) — the
 * same row-level policies that gate the project pages also gate this query.
 *
 * When `query` is provided the filter is applied server-side (case-insensitive
 * name match) so a match that falls outside the recency cap is still
 * reachable — client-side filtering over a truncated list could never find it.
 */
export async function listSearchableActivities(
  limit = 500,
  query?: string,
): Promise<SearchableActivity[]> {
  const sb = await createClient();
  let q = sb
    .from("activities")
    .select(
      "id, name, updated_at, phase:phases(name, project:projects(id, name))",
    );
  const term = query?.trim();
  if (term) q = q.ilike("name", `%${escapeLike(term)}%`);
  const { data, error } = await q
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const out: SearchableActivity[] = [];
  for (const row of data) {
    const phase = Array.isArray(row.phase) ? row.phase[0] : row.phase;
    const project = phase
      ? Array.isArray(phase.project)
        ? phase.project[0]
        : phase.project
      : null;
    if (!project?.id) continue;
    out.push({
      id: row.id as string,
      name: row.name as string,
      project_id: project.id as string,
      project_name: (project.name as string) ?? "Project",
      phase_name: (phase?.name as string | undefined) ?? null,
    });
  }
  return out;
}

export type SearchableOrg = { id: string; name: string };
export type SearchableOrgs = {
  projects: SearchableOrg[];
  clients: SearchableOrg[];
};

/**
 * Slim project + client list for the topbar search dropdown. RLS scopes
 * results to what the caller can see, so admins get the full roster while
 * staff / client users only see projects they belong to. The previous
 * implementation pre-loaded these in the layout and serialised them into
 * the RSC payload on every navigation; this is called once per dropdown
 * open instead.
 */
export async function listSearchableOrgs(
  limit = 500,
  query?: string,
): Promise<SearchableOrgs> {
  const sb = await createClient();
  const term = query?.trim();
  const like = term ? `%${escapeLike(term)}%` : null;
  let projectsQuery = sb
    .from("projects")
    .select("id, name")
    .is("archived_at", null);
  let clientsQuery = sb
    .from("clients")
    .select("id, name")
    .is("archived_at", null);
  if (like) {
    projectsQuery = projectsQuery.ilike("name", like);
    clientsQuery = clientsQuery.ilike("name", like);
  }
  const [projectsRes, clientsRes] = await Promise.all([
    projectsQuery.order("name", { ascending: true }).limit(limit),
    clientsQuery.order("name", { ascending: true }).limit(limit),
  ]);
  return {
    projects: (projectsRes.data ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
    })),
    clients: (clientsRes.data ?? []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
    })),
  };
}
