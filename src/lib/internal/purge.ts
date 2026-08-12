/**
 * Permanent deletion for the internal workspace — the step past archiving.
 *
 * Kept separate from `./archive.ts`, which promises that nothing in it is a
 * hard delete. Everything here really is: the rows go, and so do the uploaded
 * files behind them. There is no undo.
 *
 * Both entry points refuse unless the target is already archived. Deleting is
 * therefore always a deliberate second step, and a stale browser tab holding an
 * id from before an archive can never destroy live work.
 *
 * Database cascades (migrations 0033/0045/0048/0049) take subtasks, assignees,
 * comments, document rows and bell notifications with the task. Storage objects
 * do NOT cascade, so file paths are collected and removed explicitly — miss
 * that and the `proofs` bucket keeps orphans nobody can reach.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { dbErrorMessage } from '@/lib/db-errors';
import type { Database } from '@/lib/supabase/types';
import type { ActionResult } from '@/lib/action-result';

type Sb = SupabaseClient<Database>;

/** Delete the storage objects for a set of tasks. Best-effort by design. */
async function removeTaskFiles(sb: Sb, taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  const { data: proofs } = await sb
    .from('internal_task_proofs')
    .select('file_path')
    .in('task_id', taskIds);

  const paths = (proofs ?? [])
    .map((p) => p.file_path)
    .filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;

  // A storage failure must not abort the delete: leaving the rows behind for a
  // stranded file would be the worse outcome, and the paths are recoverable
  // from the bucket listing if it ever matters.
  const { error } = await sb.storage.from('proofs').remove(paths);
  if (error) {
    console.error('[purge] could not remove storage objects', error);
  }
}

/**
 * Permanently delete an archived task, its subtasks, and everything attached.
 */
export async function purgeTask(sb: Sb, taskId: string): Promise<ActionResult> {
  const { data: task, error: readError } = await sb
    .from('internal_tasks')
    .select('id, archived_at')
    .eq('id', taskId)
    .maybeSingle();
  if (readError) return { ok: false, error: dbErrorMessage(readError) };
  if (!task) return { ok: false, error: 'Task not found' };
  if (!task.archived_at) {
    return { ok: false, error: 'Delete the task first, then remove it from the archive.' };
  }

  const { data: subtasks } = await sb
    .from('internal_tasks')
    .select('id')
    .eq('parent_task_id', taskId);

  await removeTaskFiles(sb, [taskId, ...(subtasks ?? []).map((s) => s.id)]);

  // Subtasks go with the parent via parent_task_id's ON DELETE CASCADE.
  const { error } = await sb.from('internal_tasks').delete().eq('id', taskId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true };
}

/**
 * Permanently delete an archived section and every task inside it.
 *
 * `internal_tasks.area_id` is ON DELETE RESTRICT, so the tasks must go first —
 * deleting the section alone would just fail.
 */
export async function purgeArea(sb: Sb, areaId: string): Promise<ActionResult> {
  const { data: area, error: readError } = await sb
    .from('internal_areas')
    .select('id, archived_at')
    .eq('id', areaId)
    .maybeSingle();
  if (readError) return { ok: false, error: dbErrorMessage(readError) };
  if (!area) return { ok: false, error: 'Section not found' };
  if (!area.archived_at) {
    return {
      ok: false,
      error: 'Delete the section first, then remove it from the archive.',
    };
  }

  const { data: tasks } = await sb
    .from('internal_tasks')
    .select('id')
    .eq('area_id', areaId);
  const taskIds = (tasks ?? []).map((t) => t.id);

  await removeTaskFiles(sb, taskIds);

  if (taskIds.length > 0) {
    const { error: tasksError } = await sb
      .from('internal_tasks')
      .delete()
      .eq('area_id', areaId);
    if (tasksError) return { ok: false, error: dbErrorMessage(tasksError) };
  }

  const { error } = await sb.from('internal_areas').delete().eq('id', areaId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true };
}

/** What a permanent delete will take, for the confirmation dialog. */
export async function summariseTaskDeletion(
  sb: Sb,
  taskId: string,
): Promise<ActionResult<{ subtasks: number; documents: number; comments: number }>> {
  const { data: subtasks } = await sb
    .from('internal_tasks')
    .select('id')
    .eq('parent_task_id', taskId);
  const ids = [taskId, ...(subtasks ?? []).map((s) => s.id)];

  const [{ count: documents }, { count: comments }] = await Promise.all([
    sb
      .from('internal_task_proofs')
      .select('id', { count: 'exact', head: true })
      .in('task_id', ids),
    sb
      .from('internal_task_comments')
      .select('id', { count: 'exact', head: true })
      .in('task_id', ids),
  ]);

  return {
    ok: true,
    data: {
      subtasks: subtasks?.length ?? 0,
      documents: documents ?? 0,
      comments: comments ?? 0,
    },
  };
}
