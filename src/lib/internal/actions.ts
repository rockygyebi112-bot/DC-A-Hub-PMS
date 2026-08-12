'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { currentUserId } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/require-role-server';
import { dbErrorMessage } from '@/lib/db-errors';
import { areaSchema, taskSchema } from './schemas';
import { notifyInternalTaskAssigned } from './notifications';
import {
  archiveAreaWithTasks,
  archiveTaskTree,
  countActiveAreaTasks,
  restoreAreaWithTasks,
  restoreTaskTree,
} from './archive';
import { purgeArea, purgeTask, summariseTaskDeletion } from './purge';
import type { ActionResult } from '@/lib/action-result';

function formValue(fd: FormData, key: string) {
  return (fd.get(key) ?? '') as string;
}

// ---------- sections (a.k.a. areas) — staff + admin (migration 0047) ----------
export async function createArea(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireRole(['admin', 'staff']);
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
  const auth = await requireRole(['admin', 'staff']);
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

function revalidateInternal() {
  revalidatePath('/admin/internal/areas');
  revalidatePath('/workspace/internal');
}

/**
 * Archive a section together with every active task inside it.
 *
 * Admin-only: one click here can sweep away dozens of other people's tasks.
 * Note the restriction is enforced here rather than in RLS — migration 0047
 * deliberately lets staff update `internal_areas`, and a policy cannot tell
 * "archiving" apart from the renames staff legitimately do.
 */
export async function archiveArea(areaId: string): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return auth;
  const result = await archiveAreaWithTasks(await createClient(), areaId);
  if (!result.ok) return result;
  revalidateInternal();
  return { ok: true };
}

/** Bring back a section and the tasks that `archiveArea` took with it. */
export async function restoreArea(areaId: string): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return auth;
  const result = await restoreAreaWithTasks(await createClient(), areaId);
  if (!result.ok) return result;
  revalidateInternal();
  return { ok: true };
}

/** How many active tasks a section holds — the confirmation dialog's count. */
export async function countSectionTasks(
  areaId: string,
): Promise<ActionResult<{ count: number }>> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  return countActiveAreaTasks(await createClient(), areaId);
}

// ---------- permanent deletion (archived items only, admin-only) ----------

/**
 * Destroy an archived task for good, with its subtasks, comments and uploaded
 * files. Admin-only and irreversible; `purgeTask` refuses anything not already
 * archived, so this is always the deliberate second step.
 */
export async function deleteTaskPermanently(
  taskId: string,
  parentId?: string,
): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return auth;
  const result = await purgeTask(await createClient(), taskId);
  if (!result.ok) return result;
  revalidateInternal();
  if (parentId) revalidatePath(`/workspace/internal/${parentId}`);
  return { ok: true };
}

/** Destroy an archived section and every task in it for good. Admin-only. */
export async function deleteAreaPermanently(areaId: string): Promise<ActionResult> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return auth;
  const result = await purgeArea(await createClient(), areaId);
  if (!result.ok) return result;
  revalidateInternal();
  return { ok: true };
}

/** What a permanent delete would take — drives the confirmation copy. */
export async function describeTaskDeletion(
  taskId: string,
): Promise<ActionResult<{ subtasks: number; documents: number; comments: number }>> {
  const auth = await requireRole(['admin']);
  if (!auth.ok) return auth;
  return summariseTaskDeletion(await createClient(), taskId);
}

/**
 * Persist a new section ordering. Takes the full ordered list of section ids
 * and renumbers `position` in steps of 1000. Requires migration 0046 (the
 * `position` column); on older databases the update simply errors and the UI
 * surfaces the message.
 */
export async function reorderSections(orderedIds: string[]): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const ids = idsSchema.safeParse(orderedIds);
  if (!ids.success || ids.data.length === 0) {
    return { ok: false, error: 'Invalid section order' };
  }
  const sb = await createClient();
  const results = await Promise.all(
    ids.data.map((id, i) =>
      sb
        .from('internal_areas')
        .update({ position: (i + 1) * 1000 })
        .eq('id', id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: dbErrorMessage(failed.error) };
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
      // `.select()` so we notify only the assignments the database confirmed.
      // The upsert is one statement: a single bad id rolls all of them back,
      // and emailing someone about an assignment that doesn't exist would
      // point them at a task they can't read.
      const { data: assigned, error: assignError } = await sb
        .from('internal_task_assignees')
        .upsert(
          parsedIds.data.map((uid) => ({ task_id: task.id, user_id: uid })),
          { onConflict: 'task_id,user_id', ignoreDuplicates: true },
        )
        .select('user_id');
      if (assignError) {
        console.error('[createTask] assignee upsert failed', assignError);
      } else if (assigned?.length) {
        // Belt-and-braces: the writer already guarantees it never throws.
        await notifyInternalTaskAssigned({
          taskId: task.id,
          assigneeIds: assigned.map((r) => r.user_id),
          actorUserId: userId,
        }).catch((err) => {
          console.error('[createTask] assignment notification failed', err);
        });
      }
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

// ---------- subtasks (0048) ----------

/** Create a child task under a parent. Subtasks inherit the parent's section. */
export async function createSubtask(
  parentId: string,
  title: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const clean = title.trim().slice(0, 200);
  if (!clean) return { ok: false, error: 'Subtask name is required' };

  const sb = await createClient();
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: 'Not authenticated' };

  const { data: parent, error: parentErr } = await sb
    .from('internal_tasks')
    .select('area_id')
    .eq('id', parentId)
    .single();
  if (parentErr || !parent) return { ok: false, error: 'Parent task not found' };

  const { data: task, error } = await sb
    .from('internal_tasks')
    .insert({
      area_id: parent.area_id,
      title: clean,
      status: 'not_started',
      created_by: userId,
      parent_task_id: parentId,
    })
    .select('id')
    .single();
  if (error || !task) return { ok: false, error: dbErrorMessage(error) };

  // Mirror createTask: add the creator as an assignee so they retain visibility.
  await sb.from('internal_task_assignees').insert({ task_id: task.id, user_id: userId });

  revalidatePath(`/workspace/internal/${parentId}`);
  return { ok: true, data: { id: task.id } };
}

/** Archive a task. Its subtasks go with it and come back with it. */
export async function archiveTask(taskId: string): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const sb = await createClient();
  const result = await archiveTaskTree(sb, taskId);
  if (!result.ok) return result;
  revalidateInternal();
  revalidatePath(`/workspace/internal/${taskId}`);
  return { ok: true };
}

export async function restoreTask(taskId: string): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const sb = await createClient();
  const result = await restoreTaskTree(sb, taskId);
  if (!result.ok) return result;
  revalidateInternal();
  revalidatePath(`/workspace/internal/${taskId}`);
  return { ok: true };
}

/**
 * Archive a subtask. Same machinery as `archiveTask`; separate only so the
 * parent's detail page is the thing revalidated.
 */
export async function archiveSubtask(
  subtaskId: string,
  parentId: string,
): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const sb = await createClient();
  const result = await archiveTaskTree(sb, subtaskId);
  if (!result.ok) return result;
  revalidatePath(`/workspace/internal/${parentId}`);
  return { ok: true };
}

export async function restoreSubtask(
  subtaskId: string,
  parentId: string,
): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const sb = await createClient();
  const result = await restoreTaskTree(sb, subtaskId);
  if (!result.ok) return result;
  revalidatePath(`/workspace/internal/${parentId}`);
  return { ok: true };
}

export async function addAssignee(
  taskId: string,
  userId: string,
): Promise<ActionResult> {
  const auth = await requireRole(['admin', 'staff']);
  if (!auth.ok) return auth;
  const sb = await createClient();
  // `.select()` so an ignored duplicate comes back as an empty array: re-adding
  // an existing assignee changes nothing and must not notify.
  const { data: inserted, error } = await sb
    .from('internal_task_assignees')
    .upsert(
      { task_id: taskId, user_id: userId },
      { onConflict: 'task_id,user_id', ignoreDuplicates: true },
    )
    .select('user_id');
  if (error) return { ok: false, error: dbErrorMessage(error) };

  if ((inserted?.length ?? 0) > 0) {
    // Belt-and-braces: the writer already guarantees it never throws.
    await notifyInternalTaskAssigned({
      taskId,
      assigneeIds: [userId],
      actorUserId: auth.userId,
    }).catch((err) => {
      console.error('[addAssignee] assignment notification failed', err);
    });
  }

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
