import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getActivity,
  getWorkspaceProject,
  listActivityProofs,
  listActivityTimeline,
  listProjectPhases,
  listProjectTeam,
  listWorkspaceProjects,
} from "@/lib/workspace/queries";

export type PortalManager = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
};

export async function listPortalProjects() {
  return listWorkspaceProjects();
}

export async function getPortalProject(projectId: string) {
  // Previously this fanned out to listWorkspaceProjects() (every project
  // + every phase + every activity in the org) just to locate one row.
  // getWorkspaceProject fetches the same shape with a single targeted
  // query, dropping TTFB on /portal/projects/[id] proportionally with
  // org size.
  return getWorkspaceProject(projectId);
}

export async function getPortalProjectDetail(projectId: string) {
  const [project, phases, manager] = await Promise.all([
    getPortalProject(projectId),
    listProjectPhases(projectId),
    getProjectManager(projectId),
  ]);

  if (!project) return null;

  return {
    project,
    phases,
    manager,
    percentComplete:
      project.totalCount === 0
        ? 0
        : Math.round((project.doneCount / project.totalCount) * 100),
  };
}

export async function getPortalActivity(activityId: string) {
  // Kick off the activity-id-only reads in parallel with `getActivity` itself.
  // The team query depends on the activity's `project_id`, so it stays inside
  // the chained `.then()` and only fires after the activity row resolves —
  // but that single dependency no longer blocks proofs + timeline.
  const activityPromise = getActivity(activityId);
  const teamPromise = activityPromise.then((a) => {
    const projectId = a.phase?.project_id;
    return projectId ? listProjectTeam(projectId) : [];
  });
  const [activity, proofs, timeline, team] = await Promise.all([
    activityPromise,
    listActivityProofs(activityId),
    listActivityTimeline(activityId),
    teamPromise,
  ]);
  return { activity, proofs, timeline, team };
}

/* -------------------- helpers -------------------- */

async function getProjectManager(projectId: string): Promise<PortalManager | null> {
  // Prefer the explicitly designated PM (project_role='manager'). Fall
  // back to the most senior staff member if no PM has been set yet so
  // older projects still surface a useful contact.
  const team = await listProjectTeam(projectId);
  const designated = team.find((m) => m.project_role === "manager");
  const fromDesignated = designated?.profile;
  if (fromDesignated) {
    return {
      user_id: fromDesignated.user_id,
      full_name: fromDesignated.full_name,
      email: fromDesignated.email,
      role: fromDesignated.role,
    };
  }
  const candidates = team
    .filter((m) => m.project_role !== "viewer")
    .map((m) => m.profile)
    .filter((p): p is NonNullable<typeof p> => !!p);
  if (candidates.length === 0) return null;
  const ranked = [...candidates].sort((a, b) => rankRole(a.role) - rankRole(b.role));
  const top = ranked[0];
  return {
    user_id: top.user_id,
    full_name: top.full_name,
    email: top.email,
    role: top.role,
  };
}

function rankRole(role: string): number {
  if (role === "admin") return 0;
  if (role === "staff") return 1;
  return 2;
}

/**
 * Lightweight count of all proofs (files + links) in a project. Used by the
 * locked Uploads page so the gate can tell the client how many documents
 * are waiting behind the password without leaking any metadata.
 *
 * Previously this fanned out into three serial round-trips (phases → activities
 * → proofs) and shipped every intermediate id list over the wire. The embedded
 * `!inner` joins collapse that into one HEAD count request — Postgres still
 * has to walk the chain, but only a single tuple count comes back over HTTP.
 */
export async function countProjectDocuments(projectId: string): Promise<number> {
  const sb = await createClient();
  const { count } = await sb
    .from("activity_proofs")
    .select("id, activity:activities!inner(id, phase:phases!inner(project_id))", {
      count: "exact",
      head: true,
    })
    .eq("activity.phase.project_id", projectId);
  return count ?? 0;
}
