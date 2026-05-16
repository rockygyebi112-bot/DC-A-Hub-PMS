import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { throwIfError } from "@/lib/supabase/errors";
import {
  ACTIVITY_LOG_ROW,
  ACTIVITY_PROOF_ROW,
  ACTIVITY_ROW,
  PHASE_ROW,
  PROJECT_ACTIVITY_COUNTS,
} from "@/lib/supabase/columns";

export type WorkspaceProject = {
  id: string;
  name: string;
  code: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  client: { id: string; name: string; logo_url: string | null } | null;
  doneCount: number;
  totalCount: number;
};

export type WorkspacePhase = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  order_index: number;
  activities: WorkspaceActivity[];
};

export type WorkspaceActivity = {
  id: string;
  phase_id: string;
  name: string;
  // Plain notes / dependencies blob. Historically this column held the
  // concatenated "Deliverable: ... / Notes/Dependencies: ... / Responsible: ..."
  // text; migration 0020 splits Deliverable + Responsible into their own
  // columns and keeps `description` as just the notes portion.
  description: string | null;
  deliverable: string | null;
  planned_date: string | null;
  completed_date: string | null;
  status: "not_started" | "in_progress" | "done";
  narrative_note: string | null;
  responsible: string | null;
  order_index: number;
  proofCount: number;
};

export type WorkspaceProof = {
  id: string;
  activity_id: string;
  kind: "file" | "link";
  file_path: string | null;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  caption: string | null;
  url: string | null;
  created_at: string;
  signedUrl: string | null;
};

export type ListWorkspaceProjectsOptions = {
  /** Filter by project status. `"all"` (or omitted) returns every status. */
  status?: string;
  /** Sort key. Falls back to alphabetical name order if omitted. */
  sort?: "name" | "deadline" | "status" | "created";
  /** Hard cap on rows returned. Omit for no limit (legacy behaviour). */
  limit?: number;
};

type ProjectRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  created_at?: string | null;
  client:
    | { id: string; name: string; logo_url: string | null }
    | { id: string; name: string; logo_url: string | null }[]
    | null;
};

type CountsRow = {
  project_id: string;
  total_count: number | null;
  done_count: number | null;
};

export const listWorkspaceProjects = cache(
  async (options: ListWorkspaceProjectsOptions = {}): Promise<WorkspaceProject[]> => {
    const sb = await createClient();

    // Two cheap queries instead of one big nested join. The previous version
    // embedded `phases(id, activities(id, phase_id, status))` to compute a
    // single "X / Y done" label per project, which transferred every activity
    // row in the org over the wire. The `project_activity_counts` view does
    // the same arithmetic in Postgres and returns one scalar row per project.
    let projectsQuery = sb
      .from("projects")
      .select(
        "id, name, code, status, start_date, end_date, description, created_at, client:clients(id, name, logo_url)",
      )
      .is("archived_at", null);

    if (options.status && options.status !== "all") {
      projectsQuery = projectsQuery.eq("status", options.status);
    }

    // Push sort into the DB so we don't fetch then re-sort in JS.
    switch (options.sort) {
      case "deadline":
        projectsQuery = projectsQuery.order("end_date", {
          ascending: true,
          nullsFirst: false,
        });
        break;
      case "status":
        projectsQuery = projectsQuery.order("status", { ascending: true });
        break;
      case "created":
        projectsQuery = projectsQuery.order("created_at", { ascending: false });
        break;
      case "name":
      default:
        projectsQuery = projectsQuery.order("name", { ascending: true });
    }

    if (options.limit && options.limit > 0) {
      projectsQuery = projectsQuery.range(0, options.limit - 1);
    }

    const { data: projects, error } = await projectsQuery;
    throwIfError(error);
    if (!projects?.length) return [];

    const projectIds = (projects as ProjectRow[]).map((p) => p.id);
    const { data: countsRaw, error: countsError } = await sb
      .from("project_activity_counts")
      .select(PROJECT_ACTIVITY_COUNTS)
      .in("project_id", projectIds);
    throwIfError(countsError);

    const countsById = new Map<string, CountsRow>();
    for (const row of (countsRaw ?? []) as CountsRow[]) {
      countsById.set(row.project_id, row);
    }

    return (projects as ProjectRow[]).map((project) => {
      const { client, created_at: _created, ...rest } = project;
      const counts = countsById.get(project.id);
      return {
        ...rest,
        client: Array.isArray(client) ? client[0] ?? null : client,
        doneCount: Number(counts?.done_count ?? 0),
        totalCount: Number(counts?.total_count ?? 0),
      };
    });
  },
);

export const getWorkspaceProject = cache(async (
  projectId: string,
): Promise<WorkspaceProject | null> => {
  // Fetch the single project + its phase/activity counts directly. Going via
  // `listWorkspaceProjects()` previously loaded every project + every phase +
  // every activity in the workspace just to find one row, which scaled linearly
  // with the org's data and dominated the TTFB on /workspace/projects/[id].
  const sb = await createClient();
  const { data: project, error } = await sb
    .from("projects")
    .select(
      "id, name, code, status, start_date, end_date, description, archived_at, client:clients(id, name, logo_url)",
    )
    .eq("id", projectId)
    .is("archived_at", null)
    .maybeSingle();
  throwIfError(error);
  if (!project) return null;

  // One scalar row from the rollup view instead of every activity row.
  const { data: counts } = await sb
    .from("project_activity_counts")
    .select("total_count, done_count")
    .eq("project_id", projectId)
    .maybeSingle();

  const { archived_at: _archivedAt, ...rest } = project;
  return {
    ...rest,
    client: Array.isArray(project.client) ? project.client[0] ?? null : project.client,
    doneCount: Number(counts?.done_count ?? 0),
    totalCount: Number(counts?.total_count ?? 0),
  };
});

export const listProjectPhases = cache(async (projectId: string): Promise<WorkspacePhase[]> => {
  const sb = await createClient();
  const { data: phases, error } = await sb
    .from("phases")
    .select(PHASE_ROW)
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });
  throwIfError(error);
  if (!phases?.length) return [];

  const phaseIds = phases.map((phase) => phase.id);
  const { data: activities, error: activityError } = await sb
    .from("activities")
    .select(ACTIVITY_ROW)
    .in("phase_id", phaseIds)
    .order("order_index", { ascending: true });
  throwIfError(activityError);

  const activityIds = (activities ?? []).map((activity) => activity.id);
  const { data: proofs } = activityIds.length
    ? await sb.from("activity_proofs").select("id, activity_id").in("activity_id", activityIds)
    : { data: [] };
  const proofCounts = new Map<string, number>();
  for (const proof of proofs ?? []) {
    proofCounts.set(proof.activity_id, (proofCounts.get(proof.activity_id) ?? 0) + 1);
  }

  const byPhase = new Map<string, WorkspaceActivity[]>();
  for (const activity of activities ?? []) {
    const list = byPhase.get(activity.phase_id) ?? [];
    list.push({
      ...activity,
      status: activity.status as WorkspaceActivity["status"],
      proofCount: proofCounts.get(activity.id) ?? 0,
    });
    byPhase.set(activity.phase_id, list);
  }

  return phases.map((phase) => ({
    ...phase,
    activities: byPhase.get(phase.id) ?? [],
  }));
});

/**
 * Lean phase list — id + name + order_index only, no activities / proofs.
 * Use on pages that just need to render a phase selector or compute a
 * phase index. `listProjectPhases` pulls every activity + per-activity
 * proof count and is wasteful for those cases.
 */
export const listProjectPhasesLite = cache(
  async (
    projectId: string,
  ): Promise<{ id: string; name: string; order_index: number }[]> => {
    const sb = await createClient();
    const { data, error } = await sb
      .from("phases")
      .select("id, name, order_index")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true });
    throwIfError(error);
    return data ?? [];
  },
);

export async function getPhase(phaseId: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("phases")
    .select(PHASE_ROW)
    .eq("id", phaseId)
    .single();
  throwIfError(error);
  return data;
}

export const getActivity = cache(async (activityId: string) => {
  const sb = await createClient();
  const { data, error } = await sb
    .from("activities")
    .select(`${ACTIVITY_ROW}, phase:phases(id, name, project_id, project:projects(id, name, code))`)
    .eq("id", activityId)
    .single();
  throwIfError(error);
  return {
    ...data,
    status: data.status as WorkspaceActivity["status"],
    phase: Array.isArray(data.phase) ? data.phase[0] ?? null : data.phase,
  };
});

/**
 * Returns proof metadata only. Signed URLs are intentionally NOT minted here
 * so attached documents and links aren't directly clickable from any rendered
 * page — every access now goes through `requestProofAccess`, which logs the
 * view, re-verifies project membership, and issues a short-lived signed URL.
 */
export type ActivityTimelineEvent = {
  id: string;
  action: string;
  created_at: string;
  actor_name: string | null;
  meta: Record<string, unknown>;
};

/**
 * Lifecycle log for a single activity, surfaced as a vertical timeline on the
 * activity detail page. Pulls from `activity_log` (rows we already write on
 * create/start/done/proof events) and joins actor profiles in a second
 * round-trip — same pattern used by the portal announcements feed.
 */
export const listActivityTimeline = cache(async (
  activityId: string,
): Promise<ActivityTimelineEvent[]> => {
  const sb = await createClient();
  const { data: rows, error } = await sb
    .from("activity_log")
    .select(ACTIVITY_LOG_ROW)
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true });
  throwIfError(error);
  if (!rows?.length) return [];

  const actorIds = Array.from(
    new Set(rows.map((row) => row.actor_user_id).filter((value): value is string => !!value)),
  );
  const { data: profiles } = actorIds.length
    ? await sb.from("profiles").select("user_id, full_name").in("user_id", actorIds)
    : { data: [] as { user_id: string; full_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    created_at: row.created_at,
    actor_name: row.actor_user_id ? nameById.get(row.actor_user_id) ?? null : null,
    meta: (row.meta ?? {}) as Record<string, unknown>,
  }));
});

export const listActivityProofs = cache(async (activityId: string): Promise<WorkspaceProof[]> => {
  const sb = await createClient();
  const { data, error } = await sb
    .from("activity_proofs")
    .select(ACTIVITY_PROOF_ROW)
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false });
  throwIfError(error);

  return (data ?? []).map((proof): WorkspaceProof => {
    const kind = (proof.kind === "link" ? "link" : "file") as "file" | "link";
    return { ...proof, kind, signedUrl: null };
  });
});

export const listProjectTeam = cache(async (projectId: string) => {
  const sb = await createClient();
  const { data: members, error } = await sb
    .from("project_members")
    .select("id, user_id, project_role")
    .eq("project_id", projectId);
  throwIfError(error);
  if (!members?.length) return [];

  const { data: profiles } = await sb
    .from("profiles")
    .select("user_id, full_name, email, role")
    .in("user_id", members.map((member) => member.user_id));
  const byUserId = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

  return members.map((member) => ({
    ...member,
    profile: byUserId.get(member.user_id) ?? null,
  }));
});

/**
 * Cross-request cached loader powering the workspace shell. Returns just
 * the bits the layout needs — projects for the sidebar/search and the
 * notification feed — so every page navigation can be served from the
 * server-side cache instead of issuing fresh Supabase calls. Bust with
 * `revalidateTag('workspace-layout')` or
 * `revalidateTag('workspace-layout-<userId>')` from server actions.
 */
export type WorkspaceLayoutData = {
  projects: WorkspaceProject[];
};

// Previously wrapped in `unstable_cache`, but `listWorkspaceProjects` uses
// Supabase with `cookies()` for per-user RLS — disallowed inside
// `unstable_cache`. React's `cache()` still dedupes within a request.
export const getWorkspaceLayoutData = cache(
  async (_userId: string): Promise<WorkspaceLayoutData> => {
    const projects = await listWorkspaceProjects().catch(() => [] as WorkspaceProject[]);
    return { projects };
  },
);
