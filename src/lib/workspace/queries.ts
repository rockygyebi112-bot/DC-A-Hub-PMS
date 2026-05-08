import "server-only";

import { createClient } from "@/lib/supabase/server";

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
  description: string | null;
  planned_date: string | null;
  completed_date: string | null;
  status: "not_started" | "in_progress" | "done";
  location: string | null;
  participants_count: number | null;
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

export async function listWorkspaceProjects(): Promise<WorkspaceProject[]> {
  const sb = await createClient();
  const { data: projects, error } = await sb
    .from("projects")
    .select("id, name, code, status, start_date, end_date, description, client:clients(id, name, logo_url)")
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (error) throw error;
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
      client: Array.isArray(project.client) ? project.client[0] ?? null : project.client,
      doneCount: count.done,
      totalCount: count.total,
    };
  });
}

export async function getWorkspaceProject(projectId: string): Promise<WorkspaceProject> {
  const projects = await listWorkspaceProjects();
  const project = projects.find((item) => item.id === projectId);
  if (!project) throw new Error("Project not found");
  return project;
}

export async function listProjectPhases(projectId: string): Promise<WorkspacePhase[]> {
  const sb = await createClient();
  const { data: phases, error } = await sb
    .from("phases")
    .select("id, project_id, name, description, start_date, end_date, order_index")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  if (!phases?.length) return [];

  const phaseIds = phases.map((phase) => phase.id);
  const { data: activities, error: activityError } = await sb
    .from("activities")
    .select("id, phase_id, name, description, planned_date, completed_date, status, location, participants_count, narrative_note, responsible, order_index")
    .in("phase_id", phaseIds)
    .order("order_index", { ascending: true });
  if (activityError) throw activityError;

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
}

export async function getPhase(phaseId: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("phases")
    .select("id, project_id, name, description, start_date, end_date, order_index")
    .eq("id", phaseId)
    .single();
  if (error) throw error;
  return data;
}

export async function getActivity(activityId: string) {
  const sb = await createClient();
  const { data, error } = await sb
    .from("activities")
    .select("id, phase_id, name, description, planned_date, completed_date, status, location, participants_count, narrative_note, responsible, order_index, phase:phases(id, name, project_id, project:projects(id, name, code))")
    .eq("id", activityId)
    .single();
  if (error) throw error;
  return {
    ...data,
    status: data.status as WorkspaceActivity["status"],
    phase: Array.isArray(data.phase) ? data.phase[0] ?? null : data.phase,
  };
}

export async function listActivityProofs(activityId: string): Promise<WorkspaceProof[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("activity_proofs")
    .select("id, activity_id, kind, file_path, file_name, mime_type, size_bytes, caption, url, created_at")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (proof): Promise<WorkspaceProof> => {
      const kind = (proof.kind === "link" ? "link" : "file") as "file" | "link";
      let signedUrl: string | null = null;
      if (kind === "file" && proof.file_path) {
        const { data: signed } = await sb.storage
          .from("proofs")
          .createSignedUrl(proof.file_path, 60 * 60);
        signedUrl = signed?.signedUrl ?? null;
      }
      return { ...proof, kind, signedUrl };
    }),
  );
}

export async function listProjectTeam(projectId: string) {
  const sb = await createClient();
  const { data: members, error } = await sb
    .from("project_members")
    .select("id, user_id, project_role")
    .eq("project_id", projectId);
  if (error) throw error;
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
}

