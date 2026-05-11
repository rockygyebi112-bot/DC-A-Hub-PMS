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
