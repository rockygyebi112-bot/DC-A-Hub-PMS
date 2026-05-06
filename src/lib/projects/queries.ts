import { createClient } from "@/lib/supabase/client";
import type {
  Project,
  ProjectActivity,
  ProjectActivityAttachment,
  ProjectActivityUpdate,
  ProjectMilestone,
} from "./types";

export async function listProjects(): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Project | null) ?? null;
}

export async function listMilestones(
  projectId: string,
): Promise<ProjectMilestone[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProjectMilestone[];
}

export async function listActivities(
  projectId: string,
): Promise<ProjectActivity[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_activities")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProjectActivity[];
}

export async function listUpdates(
  activityId: string,
): Promise<ProjectActivityUpdate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_activity_updates")
    .select("*")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectActivityUpdate[];
}

export async function listAttachments(
  activityId: string,
): Promise<ProjectActivityAttachment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_activity_attachments")
    .select("*")
    .eq("activity_id", activityId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectActivityAttachment[];
}
