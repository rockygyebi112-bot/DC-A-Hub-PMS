import "server-only";

import { createClient } from "@/lib/supabase/server";

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
 * Capped to keep the layout payload bounded; users with more activities
 * than this still find them by typing more specific terms (the cap is
 * applied AFTER ordering by most recently updated).
 */
export async function listSearchableActivities(
  limit = 500,
): Promise<SearchableActivity[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("activities")
    .select(
      "id, name, updated_at, phase:phases(name, project:projects(id, name))",
    )
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
): Promise<SearchableOrgs> {
  const sb = await createClient();
  const [projectsRes, clientsRes] = await Promise.all([
    sb
      .from("projects")
      .select("id, name")
      .is("archived_at", null)
      .order("name", { ascending: true })
      .limit(limit),
    sb
      .from("clients")
      .select("id, name")
      .is("archived_at", null)
      .order("name", { ascending: true })
      .limit(limit),
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
