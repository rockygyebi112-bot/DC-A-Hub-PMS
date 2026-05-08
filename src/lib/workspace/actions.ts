"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
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

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeStatus(value: unknown): "not_started" | "in_progress" | "done" {
  const text = String(value ?? "").toLowerCase().trim();
  if (["done", "complete", "completed", "closed"].includes(text)) return "done";
  if (["in progress", "in-progress", "ongoing", "started"].includes(text)) return "in_progress";
  return "not_started";
}

function getCell(row: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(row);
  for (const name of names) {
    const found = entries.find(([key]) => normalizeKey(key) === normalizeKey(name));
    if (found && found[1] != null) return String(found[1]).trim();
  }
  return "";
}

function buildActivityDescription({
  deliverable,
  notes,
  responsible,
}: {
  deliverable: string;
  notes: string;
  responsible: string;
}) {
  return [
    deliverable && `Deliverable: ${deliverable}`,
    notes && `Notes/Dependencies: ${notes}`,
    responsible && `Responsible: ${responsible}`,
  ]
    .filter(Boolean)
    .join("\n");
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
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true };
}

export async function importWorkplanSheet(
  projectId: string,
  formData: FormData,
): Promise<ActionResult<{ phasesCreated: number; activitiesCreated: number; activitiesUpdated: number }>> {
  const file = formData.get("workplan");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an Excel checklist to import" };
  }

  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase() === "checklist") ??
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { ok: false, error: "No worksheet found in the upload" };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  if (rows.length === 0) return { ok: false, error: "No checklist rows found" };

  const sb = await createClient();
  const userId = await currentUserId();
  const { data: existingPhases, error: phaseError } = await sb
    .from("phases")
    .select("id, name, order_index")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });
  if (phaseError) return { ok: false, error: phaseError.message };

  const phaseByName = new Map(
    (existingPhases ?? []).map((phase) => [normalizeKey(phase.name), phase]),
  );
  let nextPhaseIndex =
    (existingPhases ?? []).reduce((max, phase) => Math.max(max, phase.order_index), -1) + 1;
  let currentPhaseName = "";
  let phasesCreated = 0;
  let activitiesCreated = 0;
  let activitiesUpdated = 0;

  for (const row of rows) {
    const phaseName = getCell(row, ["Category", "Phase"]);
    const activityName = getCell(row, ["Activity", "Task Description", "Task"]);
    if (phaseName) currentPhaseName = phaseName;
    if (!currentPhaseName || !activityName) continue;

    let phase = phaseByName.get(normalizeKey(currentPhaseName));
    if (!phase) {
      const { data: created, error } = await sb
        .from("phases")
        .insert({
          project_id: projectId,
          name: currentPhaseName,
          order_index: nextPhaseIndex++,
        })
        .select("id, name, order_index")
        .single();
      if (error) return { ok: false, error: error.message };
      phase = created;
      phaseByName.set(normalizeKey(currentPhaseName), phase);
      phasesCreated += 1;
    }

    const deliverable = getCell(row, ["Deliverable"]);
    const notes = getCell(row, ["Notes/Dependencies", "Notes", "Dependencies"]);
    const responsible = getCell(row, ["Responsible Team Member/Team", "Responsible"]);
    const status = normalizeStatus(getCell(row, ["Status"]));
    const description = buildActivityDescription({ deliverable, notes, responsible });

    const { data: existingActivity, error: existingError } = await sb
      .from("activities")
      .select("id")
      .eq("phase_id", phase.id)
      .ilike("name", activityName)
      .maybeSingle();
    if (existingError) return { ok: false, error: existingError.message };

    if (existingActivity) {
      const { error } = await sb
        .from("activities")
        .update({
          description: description || null,
          status,
        })
        .eq("id", existingActivity.id);
      if (error) return { ok: false, error: error.message };
      activitiesUpdated += 1;
    } else {
      const { count } = await sb
        .from("activities")
        .select("*", { count: "exact", head: true })
        .eq("phase_id", phase.id);
      const { data: activity, error } = await sb
        .from("activities")
        .insert({
          phase_id: phase.id,
          name: activityName,
          description: description || null,
          status,
          order_index: count ?? 0,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) return { ok: false, error: error.message };

      await sb.from("activity_log").insert({
        project_id: projectId,
        activity_id: activity.id,
        actor_user_id: userId,
        action: "created",
        meta: { source: "workplan_import", sheet: sheetName },
      });
      activitiesCreated += 1;
    }
  }

  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true, data: { phasesCreated, activitiesCreated, activitiesUpdated } };
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
  revalidatePath(`/admin/projects/${phase?.project_id}`);
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
  revalidatePath(`/admin/projects/${projectId}`);
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
    revalidatePath(`/admin/projects/${projectId}`);
  }
  revalidatePath(`/workspace/projects/${projectId}/activities/${activityId}`);
  revalidatePath(`/portal/projects/${projectId}/activities/${activityId}`);
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true };
}

async function collectProofPaths(sb: Awaited<ReturnType<typeof createClient>>, activityIds: string[]) {
  if (activityIds.length === 0) return [] as string[];
  const { data } = await sb
    .from("activity_proofs")
    .select("file_path")
    .in("activity_id", activityIds);
  return (data ?? []).map((p) => p.file_path).filter(Boolean);
}

async function removeStorageFiles(
  sb: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
) {
  if (paths.length === 0) return;
  // Storage SDK accepts up to ~1000 paths per call.
  const chunkSize = 100;
  for (let i = 0; i < paths.length; i += chunkSize) {
    await sb.storage.from("proofs").remove(paths.slice(i, i + chunkSize));
  }
}

export async function deleteActivity(activityId: string): Promise<ActionResult<{ projectId: string }>> {
  const sb = await createClient();
  const { data: activity, error: lookupError } = await sb
    .from("activities")
    .select("id, phase:phases(project_id)")
    .eq("id", activityId)
    .single();
  if (lookupError || !activity) return { ok: false, error: lookupError?.message ?? "Activity not found" };
  const phase = Array.isArray(activity.phase) ? activity.phase[0] : activity.phase;
  const projectId = phase?.project_id;
  if (!projectId) return { ok: false, error: "Project not found" };

  const paths = await collectProofPaths(sb, [activityId]);
  await removeStorageFiles(sb, paths);

  const { error } = await sb.from("activities").delete().eq("id", activityId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
  return { ok: true, data: { projectId } };
}

export async function deletePhase(phaseId: string): Promise<ActionResult<{ projectId: string }>> {
  const sb = await createClient();
  const { data: phase, error: lookupError } = await sb
    .from("phases")
    .select("id, project_id")
    .eq("id", phaseId)
    .single();
  if (lookupError || !phase) return { ok: false, error: lookupError?.message ?? "Phase not found" };

  const { data: activityRows } = await sb.from("activities").select("id").eq("phase_id", phaseId);
  const activityIds = (activityRows ?? []).map((a) => a.id);
  const paths = await collectProofPaths(sb, activityIds);
  await removeStorageFiles(sb, paths);

  const { error } = await sb.from("phases").delete().eq("id", phaseId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/workspace/projects/${phase.project_id}`);
  revalidatePath(`/portal/projects/${phase.project_id}`);
  return { ok: true, data: { projectId: phase.project_id } };
}

export async function deleteWorkplan(projectId: string): Promise<ActionResult> {
  const sb = await createClient();
  const { data: phases, error: phaseError } = await sb
    .from("phases")
    .select("id")
    .eq("project_id", projectId);
  if (phaseError) return { ok: false, error: phaseError.message };

  const phaseIds = (phases ?? []).map((p) => p.id);
  if (phaseIds.length === 0) {
    revalidatePath(`/workspace/projects/${projectId}`);
    return { ok: true };
  }

  const { data: activityRows } = await sb.from("activities").select("id").in("phase_id", phaseIds);
  const activityIds = (activityRows ?? []).map((a) => a.id);
  const paths = await collectProofPaths(sb, activityIds);
  await removeStorageFiles(sb, paths);

  const { error } = await sb.from("phases").delete().in("id", phaseIds);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath(`/portal/projects/${projectId}`);
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
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true };
}
