import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ActivityDetailView } from "@/components/workspace/activity-detail-view";
import { SetBreadcrumbLabels } from "@/components/shell/breadcrumb-context";
import {
  deleteActivity,
  updateActivity,
  uploadProofs,
} from "@/lib/workspace/actions";
import {
  getActivity,
  listActivityProofs,
  listActivityTimeline,
  listProjectPhases,
  listProjectTeam,
} from "@/lib/workspace/queries";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { requireProjectWriter } from "@/lib/auth/guards";

export default async function WorkspaceActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; activityId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id, activityId } = await params;
  const sp = await searchParams;
  // Edit mode is URL-driven (?edit=1) so links are bookmarkable and the
  // page can stay a server component — no client-side state needed.
  const isEditing = sp.edit === "1";

  const [profile, activity, phases, proofs, timeline, team] = await Promise.all([
    getCurrentProfile(),
    getActivity(activityId),
    listProjectPhases(id),
    listActivityProofs(activityId),
    listActivityTimeline(activityId),
    listProjectTeam(id),
  ]);
  if (!profile) notFound();

  const baseHref = `/workspace/projects/${id}/activities/${activityId}`;
  const projectHref = `/workspace/projects/${id}`;

  // Phase index gives the title subtitle a stable "1. Phase Name" prefix.
  const phaseIdx = phases.findIndex((p) => p.id === activity.phase_id);
  const decoratedActivity = {
    ...activity,
    phase: activity.phase
      ? {
          ...activity.phase,
          name:
            phaseIdx >= 0 ? `${phaseIdx + 1}. ${activity.phase.name}` : activity.phase.name,
        }
      : null,
  };

  const teamUsers = team
    .map((m) => m.profile)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ name: p.full_name, email: p.email }));

  async function save(formData: FormData) {
    "use server";
    return updateActivity(activityId, formData);
  }

  async function upload(formData: FormData) {
    "use server";
    await uploadProofs(activityId, formData);
  }

  // Mark-complete reuses `updateActivity` so we keep the existing
  // notification/logging side-effects intact instead of writing to the row
  // directly.
  async function markComplete() {
    "use server";
    const fd = new FormData();
    fd.set("phase_id", activity.phase_id);
    fd.set("name", activity.name);
    fd.set("status", "done");
    fd.set("deliverable", activity.deliverable ?? "");
    fd.set("responsible", activity.responsible ?? "");
    fd.set("planned_date", activity.planned_date ?? "");
    fd.set("completed_date", activity.completed_date ?? "");
    fd.set("description", activity.description ?? "");
    fd.set("narrative_note", activity.narrative_note ?? "");
    await updateActivity(activityId, fd);
  }

  // Undo "mark complete". Status drops back to in_progress and the
  // completed_date is cleared so the activity no longer reads as done.
  async function reopen() {
    "use server";
    const fd = new FormData();
    fd.set("phase_id", activity.phase_id);
    fd.set("name", activity.name);
    fd.set("status", "in_progress");
    fd.set("deliverable", activity.deliverable ?? "");
    fd.set("responsible", activity.responsible ?? "");
    fd.set("planned_date", activity.planned_date ?? "");
    fd.set("completed_date", "");
    fd.set("description", activity.description ?? "");
    fd.set("narrative_note", activity.narrative_note ?? "");
    await updateActivity(activityId, fd);
  }

  // Free-text update posted from the composer. We persist as an
  // `activity_log` row with action="updated" + meta.note so it shows up in
  // both the Updates feed and the lifecycle Timeline without needing a new
  // table.
  async function postUpdate(formData: FormData) {
    "use server";
    const note = String(formData.get("note") ?? "").trim();
    if (!note) return { ok: false, error: "Write something first." };

    const sb = await createClient();
    const { data: row } = await sb
      .from("activities")
      .select("phase:phases(project_id)")
      .eq("id", activityId)
      .single();
    const phase = Array.isArray(row?.phase) ? row?.phase[0] : row?.phase;
    const projectId = phase?.project_id;
    if (!projectId) return { ok: false, error: "Project not found" };

    const auth = await requireProjectWriter(projectId);
    if (!auth.ok) return auth;

    const { error } = await sb.from("activity_log").insert({
      project_id: projectId,
      activity_id: activityId,
      actor_user_id: profile!.userId,
      action: "updated",
      meta: { note },
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath(baseHref);
    return { ok: true };
  }

  return (
    <>
    <SetBreadcrumbLabels
      labels={{
        [activityId]: activity.name,
        ...(activity.phase?.project ? { [id]: activity.phase.project.name } : {}),
      }}
    />
    <ActivityDetailView
      activity={decoratedActivity}
      proofs={proofs}
      timeline={timeline}
      teamUsers={teamUsers}
      user={{
        name: profile.fullName,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
      }}
      baseHref={baseHref}
      backHref={projectHref}
      backLabel="Back to workplan"
      postUpdate={postUpdate}
      upload={upload}
      isEditing={isEditing}
      phases={phases.map((p) => ({ id: p.id, name: p.name }))}
      save={save}
      markComplete={markComplete}
      reopen={reopen}
      deleteAction={async () => {
        "use server";
        return deleteActivity(activityId);
      }}
      deleteRedirectTo={projectHref}
    />
    </>
  );
}
