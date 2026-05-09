import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  listActivityProofs,
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

export type PortalDocument = {
  id: string;
  activity_id: string;
  activity_name: string | null;
  phase_name: string | null;
  kind: "file" | "link";
  file_name: string;
  mime_type: string | null;
  url: string | null;
  signedUrl: string | null;
  created_at: string;
};

export type PortalAnnouncement = {
  id: string;
  action: string;
  created_at: string;
  activity_id: string | null;
  activity_name: string | null;
  phase_name: string | null;
  actor_name: string | null;
};

export type PortalActivityFeedItem = PortalAnnouncement;

export async function listPortalProjects() {
  return listWorkspaceProjects();
}

export async function getPortalProject(projectId: string) {
  const projects = await listWorkspaceProjects();
  const project = projects.find((item) => item.id === projectId);
  if (!project) throw new Error("Project not found");
  return project;
}

export async function getPortalProjectDetail(projectId: string) {
  const [project, phases, team, manager, announcements, recentActivity, documents] =
    await Promise.all([
      getPortalProject(projectId),
      listProjectPhases(projectId),
      listProjectTeam(projectId),
      getProjectManager(projectId),
      getProjectAnnouncements(projectId, 5),
      getProjectRecentActivity(projectId, 6),
      getProjectDocuments(projectId, 5),
    ]);

  const allActivities = phases.flatMap((phase) =>
    phase.activities.map((activity) => ({ ...activity, phaseName: phase.name })),
  );
  const doneActivities = allActivities
    .filter((activity) => activity.status === "done")
    .sort((a, b) => {
      const aDate = a.completed_date ?? "";
      const bDate = b.completed_date ?? "";
      return bDate.localeCompare(aDate);
    });
  const nextMilestone =
    allActivities
      .filter((activity) => activity.status !== "done" && activity.planned_date)
      .sort((a, b) => (a.planned_date ?? "").localeCompare(b.planned_date ?? ""))[0] ?? null;

  return {
    project,
    phases,
    team,
    manager,
    announcements,
    recentActivity,
    documents,
    doneActivities,
    nextMilestone,
    percentComplete:
      project.totalCount === 0 ? 0 : Math.round((project.doneCount / project.totalCount) * 100),
  };
}

export async function getPortalActivity(activityId: string) {
  const { getActivity } = await import("@/lib/workspace/queries");
  const [activity, proofs] = await Promise.all([
    getActivity(activityId),
    listActivityProofs(activityId),
  ]);
  return { activity, proofs };
}

/* -------------------- helpers -------------------- */

async function getProjectManager(projectId: string): Promise<PortalManager | null> {
  // The "project manager" surfaced to the client is the most senior staff
  // member assigned to this project. Order: admin > staff > anyone.
  const team = await listProjectTeam(projectId);
  const candidates = team
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

async function getProjectAnnouncements(
  projectId: string,
  limit: number,
): Promise<PortalAnnouncement[]> {
  // Announcements = significant project events visible to clients.
  return fetchProjectActivityLog(projectId, limit, ["marked_done", "proof_added"]);
}

async function getProjectRecentActivity(
  projectId: string,
  limit: number,
): Promise<PortalActivityFeedItem[]> {
  return fetchProjectActivityLog(projectId, limit, [
    "marked_done",
    "started",
    "proof_added",
  ]);
}

async function fetchProjectActivityLog(
  projectId: string,
  limit: number,
  actions: string[],
): Promise<PortalAnnouncement[]> {
  const sb = await createClient();
  const { data: rows } = await sb
    .from("activity_log")
    .select("id, action, created_at, activity_id, actor_user_id")
    .eq("project_id", projectId)
    .in("action", actions)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!rows?.length) return [];

  const activityIds = Array.from(
    new Set(rows.map((r) => r.activity_id).filter((v): v is string => !!v)),
  );
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_user_id).filter((v): v is string => !!v)),
  );

  const [activitiesRes, profilesRes] = await Promise.all([
    activityIds.length
      ? sb
          .from("activities")
          .select("id, name, phase:phases(name)")
          .in("id", activityIds)
      : Promise.resolve({ data: [] as { id: string; name: string; phase: { name: string } | { name: string }[] | null }[] }),
    actorIds.length
      ? sb.from("profiles").select("user_id, full_name").in("user_id", actorIds)
      : Promise.resolve({ data: [] as { user_id: string; full_name: string }[] }),
  ]);

  const activityById = new Map(
    (activitiesRes.data ?? []).map((a) => {
      const phase = Array.isArray(a.phase) ? a.phase[0] ?? null : a.phase;
      return [a.id, { name: a.name, phaseName: phase?.name ?? null }];
    }),
  );
  const actorById = new Map(
    (profilesRes.data ?? []).map((p) => [p.user_id, p.full_name]),
  );

  return rows.map((r) => {
    const activity = r.activity_id ? activityById.get(r.activity_id) ?? null : null;
    return {
      id: r.id,
      action: r.action,
      created_at: r.created_at,
      activity_id: r.activity_id,
      activity_name: activity?.name ?? null,
      phase_name: activity?.phaseName ?? null,
      actor_name: r.actor_user_id ? actorById.get(r.actor_user_id) ?? null : null,
    };
  });
}

async function getProjectDocuments(
  projectId: string,
  limit: number,
): Promise<PortalDocument[]> {
  const sb = await createClient();

  // proofs -> activities -> phases (constrained to this project)
  const { data: phases } = await sb
    .from("phases")
    .select("id, name")
    .eq("project_id", projectId);
  const phaseIds = (phases ?? []).map((p) => p.id);
  if (phaseIds.length === 0) return [];

  const { data: activities } = await sb
    .from("activities")
    .select("id, name, phase_id")
    .in("phase_id", phaseIds);
  const activityIds = (activities ?? []).map((a) => a.id);
  if (activityIds.length === 0) return [];

  const { data: proofs } = await sb
    .from("activity_proofs")
    .select("id, activity_id, kind, file_path, file_name, mime_type, url, created_at")
    .in("activity_id", activityIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!proofs?.length) return [];

  const phaseNameById = new Map((phases ?? []).map((p) => [p.id, p.name]));
  const activityById = new Map(
    (activities ?? []).map((a) => [
      a.id,
      { name: a.name, phaseName: phaseNameById.get(a.phase_id) ?? null },
    ]),
  );

  return Promise.all(
    proofs.map(async (p): Promise<PortalDocument> => {
      const kind = (p.kind === "link" ? "link" : "file") as "file" | "link";
      let signedUrl: string | null = null;
      if (kind === "file" && p.file_path) {
        const { data: signed } = await sb.storage
          .from("proofs")
          .createSignedUrl(p.file_path, 60 * 60);
        signedUrl = signed?.signedUrl ?? null;
      }
      const meta = activityById.get(p.activity_id);
      return {
        id: p.id,
        activity_id: p.activity_id,
        activity_name: meta?.name ?? null,
        phase_name: meta?.phaseName ?? null,
        kind,
        file_name: p.file_name,
        mime_type: p.mime_type,
        url: p.url,
        signedUrl,
        created_at: p.created_at,
      };
    }),
  );
}

