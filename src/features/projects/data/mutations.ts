import { createClient } from "@/lib/supabase/client";
import { normalizePercentComplete } from "../domain/status";
import type {
  ActivityPriority,
  ActivityStatus,
  Project,
  ProjectActivity,
  ProjectActivityAttachment,
  ProjectMilestone,
} from "../domain/types";

// ---------- Projects ----------

export async function createProject(input: {
  name: string;
  slug: string;
  description?: string | null;
  owner_user_id?: string | null;
  program_slug?: string | null;
  start_date?: string | null;
  target_end_date?: string | null;
}): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  id: string,
  patch: Partial<Project>,
): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Project;
}

// ---------- Milestones ----------

export async function createMilestone(input: {
  project_id: string;
  name: string;
  description?: string | null;
  target_date?: string | null;
  order_index?: number;
}): Promise<ProjectMilestone> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_milestones")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectMilestone;
}

export async function deleteMilestone(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("project_milestones")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Activities ----------

export async function createActivity(input: {
  project_id: string;
  milestone_id?: string | null;
  parent_activity_id?: string | null;
  title: string;
  description?: string | null;
  owner_user_id?: string | null;
  due_date?: string | null;
  priority?: ActivityPriority;
  created_by: string;
}): Promise<ProjectActivity> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_activities")
    .insert({ ...input, priority: input.priority ?? "medium" })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectActivity;
}

export async function deleteActivity(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("project_activities")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function updateActivity(
  id: string,
  patch: Partial<ProjectActivity>,
): Promise<ProjectActivity> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_activities")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectActivity;
}

export async function postActivityUpdate(input: {
  activity_id: string;
  user_id: string;
  note: string;
  new_status?: ActivityStatus;
  current_status: ActivityStatus;
}): Promise<void> {
  const supabase = createClient();
  const nowIso = new Date().toISOString();
  const nextStatus = input.new_status ?? input.current_status;
  const nextPercent = normalizePercentComplete(nextStatus);

  const activityPatch: Partial<ProjectActivity> = {
    last_update_text: input.note,
    last_update_at: nowIso,
    percent_complete: nextPercent,
  };
  if (input.new_status) activityPatch.status = input.new_status;

  const { error: actErr } = await supabase
    .from("project_activities")
    .update({ ...activityPatch, updated_at: nowIso })
    .eq("id", input.activity_id);
  if (actErr) throw actErr;

  const { error: logErr } = await supabase
    .from("project_activity_updates")
    .insert({
      activity_id: input.activity_id,
      user_id: input.user_id,
      note: input.note,
      status_before: input.current_status,
      status_after: nextStatus,
    });
  if (logErr) throw logErr;
}

// ---------- Attachments ----------

const BUCKET = "project-activity-proofs";

export async function uploadAttachment(input: {
  project_id: string;
  activity_id: string;
  uploaded_by: string;
  file: File;
  caption?: string;
}): Promise<ProjectActivityAttachment> {
  const supabase = createClient();
  const ext = input.file.name.split(".").pop() ?? "bin";
  const key = `${input.project_id}/${input.activity_id}/${crypto.randomUUID()}-${input.file.name}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(key, input.file, { contentType: input.file.type });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("project_activity_attachments")
    .insert({
      activity_id: input.activity_id,
      uploaded_by: input.uploaded_by,
      file_path: key,
      file_name: input.file.name,
      mime_type: input.file.type || `application/${ext}`,
      size_bytes: input.file.size,
      caption: input.caption ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectActivityAttachment;
}

export async function deleteAttachment(
  id: string,
  file_path: string,
): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove([file_path]);
  const { error } = await supabase
    .from("project_activity_attachments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export function getAttachmentPublicUrl(filePath: string): string {
  const supabase = createClient();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function getAttachmentSignedUrl(
  filePath: string,
  expiresSec = 3600,
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresSec);
  if (error) throw error;
  return data.signedUrl;
}
