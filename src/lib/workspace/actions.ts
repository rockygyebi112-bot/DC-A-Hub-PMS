"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  activitySchema,
  activityUpdateSchema,
  phaseSchema,
} from "@/lib/workspace/schemas";
import { notifyClientViewersActivityDone } from "@/lib/workspace/notifications";

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function currentUserId() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user?.id ?? null;
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createPhase(projectId: string, formData: FormData): Promise<ActionResult> {
  const parsed = phaseSchema.safeParse({
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    start_date: formValue(formData, "start_date"),
    end_date: formValue(formData, "end_date"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = await createClient();
  const { count } = await sb
    .from("phases")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);
  const { error } = await sb.from("phases").insert({
    project_id: projectId,
    ...parsed.data,
    order_index: count ?? 0,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/workspace/projects/${projectId}`);
  return { ok: true };
}

export async function updatePhase(phaseId: string, formData: FormData): Promise<ActionResult> {
  const parsed = phaseSchema.safeParse({
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    start_date: formValue(formData, "start_date"),
    end_date: formValue(formData, "end_date"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = await createClient();
  const { data: phase } = await sb.from("phases").select("project_id").eq("id", phaseId).single();
  const { error } = await sb.from("phases").update(parsed.data).eq("id", phaseId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/workspace/projects/${phase?.project_id}`);
  revalidatePath(`/workspace/projects/${phase?.project_id}/phases/${phaseId}`);
  return { ok: true };
}

export async function createActivity(projectId: string, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = activitySchema.safeParse({
    phase_id: formValue(formData, "phase_id"),
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    planned_date: formValue(formData, "planned_date"),
    location: formValue(formData, "location"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const userId = await currentUserId();
  const sb = await createClient();
  const { count } = await sb
    .from("activities")
    .select("*", { count: "exact", head: true })
    .eq("phase_id", parsed.data.phase_id);
  const { data, error } = await sb
    .from("activities")
    .insert({
      ...parsed.data,
      order_index: count ?? 0,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await sb.from("activity_log").insert({
    project_id: projectId,
    activity_id: data.id,
    actor_user_id: userId,
    action: "created",
  });

  revalidatePath(`/workspace/projects/${projectId}`);
  return { ok: true, data };
}

export async function updateActivity(activityId: string, formData: FormData): Promise<ActionResult> {
  const parsed = activityUpdateSchema.safeParse({
    phase_id: formValue(formData, "phase_id"),
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    planned_date: formValue(formData, "planned_date"),
    location: formValue(formData, "location"),
    status: formValue(formData, "status"),
    completed_date: formValue(formData, "completed_date"),
    participants_count: formValue(formData, "participants_count"),
    narrative_note: formValue(formData, "narrative_note"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = await createClient();
  const userId = await currentUserId();
  const { data: before } = await sb
    .from("activities")
    .select("status, phase:phases(project_id)")
    .eq("id", activityId)
    .single();
  const phase = Array.isArray(before?.phase) ? before?.phase[0] : before?.phase;
  const projectId = phase?.project_id;

  const { error } = await sb.from("activities").update(parsed.data).eq("id", activityId);
  if (error) return { ok: false, error: error.message };

  if (projectId) {
    const markedDone = before?.status !== "done" && parsed.data.status === "done";
    const notification = markedDone
      ? await notifyClientViewersActivityDone({ projectId, activityId }).catch((err) => ({
          ok: false,
          reason: String(err),
        }))
      : { ok: true };

    await sb.from("activity_log").insert({
      project_id: projectId,
      activity_id: activityId,
      actor_user_id: userId,
      action: markedDone ? "marked_done" : "updated",
      meta: notification.ok ? {} : { email_error: notification.reason },
    });

    revalidatePath(`/workspace/projects/${projectId}`);
    revalidatePath(`/portal/projects/${projectId}`);
  }
  revalidatePath(`/workspace/projects/${projectId}/activities/${activityId}`);
  revalidatePath(`/portal/projects/${projectId}/activities/${activityId}`);
  return { ok: true };
}

export async function uploadProofs(activityId: string, formData: FormData): Promise<ActionResult> {
  const files = formData
    .getAll("proofs")
    .filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) return { ok: false, error: "Choose at least one file" };

  const sb = await createClient();
  const userId = await currentUserId();
  const { data: activity } = await sb
    .from("activities")
    .select("phase:phases(project_id)")
    .eq("id", activityId)
    .single();
  const phase = Array.isArray(activity?.phase) ? activity?.phase[0] : activity?.phase;
  const projectId = phase?.project_id;
  if (!projectId) return { ok: false, error: "Project not found" };

  for (const file of files) {
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "-");
    const path = `projects/${projectId}/activities/${activityId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await sb.storage.from("proofs").upload(path, file, {
      contentType: file.type || "application/octet-stream",
    });
    if (uploadError) return { ok: false, error: uploadError.message };

    const { error: insertError } = await sb.from("activity_proofs").insert({
      activity_id: activityId,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      caption: formValue(formData, "caption") || null,
      uploaded_by: userId,
    });
    if (insertError) return { ok: false, error: insertError.message };
  }

  await sb.from("activity_log").insert({
    project_id: projectId,
    activity_id: activityId,
    actor_user_id: userId,
    action: "proof_added",
    meta: { count: files.length },
  });

  revalidatePath(`/workspace/projects/${projectId}/activities/${activityId}`);
  revalidatePath(`/portal/projects/${projectId}/activities/${activityId}`);
  return { ok: true };
}

