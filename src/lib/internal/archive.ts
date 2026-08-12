/**
 * Archive/restore mechanics for the internal workspace.
 *
 * Deliberately free of `server-only`, auth and `revalidatePath`: every function
 * takes the Supabase client to use, so the server actions in `./actions.ts` can
 * pass a request-scoped client while integration tests pass a service-role one.
 * The actions are then just auth + cache invalidation around these.
 *
 * Nothing here is a hard delete. "Delete" in the UI means `archived_at` is set;
 * the rows stay put and the "Show archived" toggle brings them back into view.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { dbErrorMessage } from '@/lib/db-errors';
import type { Database } from '@/lib/supabase/types';
import type { ActionResult } from '@/lib/action-result';

type Sb = SupabaseClient<Database>;

/**
 * Mark one row archived and return the timestamp its group is keyed on.
 *
 * Archiving a section (or a parent task) archives its children with the SAME
 * timestamp, and restore brings back only the rows carrying that value — a task
 * archived by hand last week has a different stamp and stays archived. When the
 * row is already archived we reuse its existing stamp instead of minting a new
 * one, so retrying a half-finished archive completes the original group rather
 * than splitting it in two.
 */
async function stampArchived(
  sb: Sb,
  table: 'internal_areas' | 'internal_tasks',
  id: string,
): Promise<{ ok: true; archivedAt: string } | { ok: false; error: string }> {
  const { data, error } = await sb
    .from(table)
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .is('archived_at', null)
    .select('archived_at');
  if (error) return { ok: false, error: dbErrorMessage(error) };

  const stamped = data?.[0]?.archived_at;
  if (stamped) return { ok: true, archivedAt: stamped };

  const { data: existing, error: readError } = await sb
    .from(table)
    .select('archived_at')
    .eq('id', id)
    .maybeSingle();
  if (readError) return { ok: false, error: dbErrorMessage(readError) };
  if (!existing?.archived_at) return { ok: false, error: 'Not found' };
  return { ok: true, archivedAt: existing.archived_at };
}

/** Archive a section together with every active task inside it. */
export async function archiveAreaWithTasks(
  sb: Sb,
  areaId: string,
): Promise<ActionResult> {
  const stamped = await stampArchived(sb, 'internal_areas', areaId);
  if (!stamped.ok) return { ok: false, error: stamped.error };

  // Subtasks carry their parent's area_id, so this one statement covers them.
  const { error } = await sb
    .from('internal_tasks')
    .update({ archived_at: stamped.archivedAt })
    .eq('area_id', areaId)
    .is('archived_at', null);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true };
}

/** Bring back a section and the tasks `archiveAreaWithTasks` took with it. */
export async function restoreAreaWithTasks(
  sb: Sb,
  areaId: string,
): Promise<ActionResult> {
  const { data: area, error: readError } = await sb
    .from('internal_areas')
    .select('archived_at')
    .eq('id', areaId)
    .maybeSingle();
  if (readError) return { ok: false, error: dbErrorMessage(readError) };
  if (!area) return { ok: false, error: 'Section not found' };
  if (!area.archived_at) return { ok: true };

  // Tasks first: clearing the section's stamp would destroy the only record of
  // which tasks this archive took.
  const { error: tasksError } = await sb
    .from('internal_tasks')
    .update({ archived_at: null })
    .eq('area_id', areaId)
    .eq('archived_at', area.archived_at);
  if (tasksError) return { ok: false, error: dbErrorMessage(tasksError) };

  const { error } = await sb
    .from('internal_areas')
    .update({ archived_at: null })
    .eq('id', areaId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true };
}

/** Archive a task and its subtasks under one shared stamp. */
export async function archiveTaskTree(sb: Sb, taskId: string): Promise<ActionResult> {
  const stamped = await stampArchived(sb, 'internal_tasks', taskId);
  if (!stamped.ok) return { ok: false, error: stamped.error };

  const { error } = await sb
    .from('internal_tasks')
    .update({ archived_at: stamped.archivedAt })
    .eq('parent_task_id', taskId)
    .is('archived_at', null);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true };
}

/** Restore a task plus the subtasks archived alongside it. */
export async function restoreTaskTree(sb: Sb, taskId: string): Promise<ActionResult> {
  const { data: task, error: readError } = await sb
    .from('internal_tasks')
    .select('archived_at')
    .eq('id', taskId)
    .maybeSingle();
  if (readError) return { ok: false, error: dbErrorMessage(readError) };
  if (!task) return { ok: false, error: 'Task not found' };
  if (!task.archived_at) return { ok: true };

  // Subtasks first — see the ordering note in `restoreAreaWithTasks`.
  const { error: childError } = await sb
    .from('internal_tasks')
    .update({ archived_at: null })
    .eq('parent_task_id', taskId)
    .eq('archived_at', task.archived_at);
  if (childError) return { ok: false, error: dbErrorMessage(childError) };

  const { error } = await sb
    .from('internal_tasks')
    .update({ archived_at: null })
    .eq('id', taskId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true };
}

/** How many active tasks a section holds — the confirmation dialog's count. */
export async function countActiveAreaTasks(
  sb: Sb,
  areaId: string,
): Promise<ActionResult<{ count: number }>> {
  const { count, error } = await sb
    .from('internal_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('area_id', areaId)
    .is('archived_at', null);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, data: { count: count ?? 0 } };
}
