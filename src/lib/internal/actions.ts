'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { currentUserId } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/require-role';
import { dbErrorMessage } from '@/lib/db-errors';
import { areaSchema, taskSchema } from './schemas';
import type { ActionResult } from '@/lib/action-result';

function formValue(fd: FormData, key: string) {
  return (fd.get(key) ?? '') as string;
}

// ---------- areas (admin only) ----------
export async function createArea(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth;
  const parsed = areaSchema.safeParse({
    name: formValue(formData, 'name'),
    description: formValue(formData, 'description') || undefined,
    color: formValue(formData, 'color') || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = await createClient();
  const { data, error } = await sb
    .from('internal_areas')
    .insert(parsed.data)
    .select('id')
    .single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath('/admin/internal/areas');
  revalidatePath('/workspace/internal');
  return { ok: true, data: { id: data.id } };
}

export async function updateArea(
  areaId: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth;
  const parsed = areaSchema.safeParse({
    name: formValue(formData, 'name'),
    description: formValue(formData, 'description') || undefined,
    color: formValue(formData, 'color') || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
  const { error } = await sb
    .from('internal_areas')
    .update(parsed.data)
    .eq('id', areaId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath('/admin/internal/areas');
  revalidatePath('/workspace/internal');
  return { ok: true };
}

export async function archiveArea(areaId: string): Promise<ActionResult> {
  const auth = await requireRole('admin');
  if (!auth.ok) return auth;
  const sb = await createClient();
  const { count } = await sb
    .from('internal_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('area_id', areaId)
    .is('archived_at', null);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: 'Area has active tasks — reassign or archive them first.',
    };
  }
  const { error } = await sb
    .from('internal_areas')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', areaId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath('/admin/internal/areas');
  revalidatePath('/workspace/internal');
  return { ok: true };
}

// ---------- tasks ----------
const idsSchema = z.array(z.string().uuid());

export async function createTask(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;

  const parsed = taskSchema.safeParse({
    area_id: formValue(formData, 'area_id'),
    project_id: formValue(formData, 'project_id') || undefined,
    title: formValue(formData, 'title'),
    description: formValue(formData, 'description') || undefined,
    status: formValue(formData, 'status') || 'not_started',
    priority: formValue(formData, 'priority') || undefined,
    due_date: formValue(formData, 'due_date'),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = await createClient();
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const { data: task, error } = await sb
    .from('internal_tasks')
    .insert({ ...parsed.data, created_by: userId })
    .select('id')
    .single();
  if (error || !task) return { ok: false, error: dbErrorMessage(error) };

  // Always add the creator as an assignee so they retain visibility.
  await sb
    .from('internal_task_assignees')
    .insert({ task_id: task.id, user_id: userId });

  // Optional initial assignees from a hidden "assignee_ids" multi-select.
  const extraRaw = (formData.getAll('assignee_ids') as string[]).filter(Boolean);
  if (extraRaw.length) {
    const parsedIds = idsSchema.safeParse(extraRaw);
    if (parsedIds.success && parsedIds.data.length) {
      await sb
        .from('internal_task_assignees')
        .upsert(
          parsedIds.data.map((uid) => ({ task_id: task.id, user_id: uid })),
          { onConflict: 'task_id,user_id', ignoreDuplicates: true },
        );
    }
  }

  revalidatePath('/workspace/internal');
  return { ok: true, data: { id: task.id } };
}

export async function updateTask(
  taskId: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const parsed = taskSchema.partial().safeParse({
    title: formValue(formData, 'title') || undefined,
    description: formValue(formData, 'description') || undefined,
    status: formValue(formData, 'status') || undefined,
    priority: formValue(formData, 'priority') || undefined,
    due_date: formValue(formData, 'due_date') || undefined,
    area_id: formValue(formData, 'area_id') || undefined,
    project_id: formValue(formData, 'project_id') || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const sb = await createClient();
  const { error } = await sb
    .from('internal_tasks')
    .update(parsed.data)
    .eq('id', taskId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath('/workspace/internal');
  revalidatePath(`/workspace/internal/${taskId}`);
  return { ok: true };
}

export async function setTaskStatus(
  taskId: string,
  status: 'not_started' | 'in_progress' | 'blocked' | 'done',
): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const sb = await createClient();
  const { error } = await sb
    .from('internal_tasks')
    .update({ status })
    .eq('id', taskId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath('/workspace/internal');
  return { ok: true };
}

export async function addAssignee(
  taskId: string,
  userId: string,
): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const sb = await createClient();
  const { error } = await sb
    .from('internal_task_assignees')
    .upsert(
      { task_id: taskId, user_id: userId },
      { onConflict: 'task_id,user_id', ignoreDuplicates: true },
    );
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/workspace/internal/${taskId}`);
  return { ok: true };
}

export async function removeAssignee(
  taskId: string,
  userId: string,
): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const sb = await createClient();
  const { error } = await sb
    .from('internal_task_assignees')
    .delete()
    .eq('task_id', taskId)
    .eq('user_id', userId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/workspace/internal/${taskId}`);
  return { ok: true };
}
