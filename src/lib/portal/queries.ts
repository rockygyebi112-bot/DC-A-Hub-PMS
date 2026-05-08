import "server-only";

import { listActivityProofs, listProjectPhases, listWorkspaceProjects } from "@/lib/workspace/queries";

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
  const [project, phases] = await Promise.all([
    getPortalProject(projectId),
    listProjectPhases(projectId),
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

