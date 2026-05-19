import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * NOTE on assignee joins: `internal_task_assignees.user_id` references
 * `auth.users.id`, not `profiles.user_id`, so PostgREST cannot auto-derive a
 * relation to `profiles` via a foreign-key alias. Rather than add an extra
 * FK migration, we fetch `assignees(user_id)` from the embedded relationship
 * and then hydrate the matching `profiles` rows in a single follow-up query
 * keyed by `user_id`. This keeps the round-trip count at 2 (one for the list,
 * one for all referenced profiles) regardless of task count.
 */

type AssigneeProfile = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type AssigneeRow = { user_id: string };

type RawTaskRow = {
  id: string;
  area_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  assignees: AssigneeRow[] | null;
};

export type InternalTaskWithAssignees = Omit<RawTaskRow, 'assignees'> & {
  assignees: Array<{ user_id: string; profile: AssigneeProfile | null }>;
};

async function hydrateAssigneeProfiles(
  sb: Awaited<ReturnType<typeof createClient>>,
  rows: RawTaskRow[],
): Promise<InternalTaskWithAssignees[]> {
  const userIds = Array.from(
    new Set(rows.flatMap((r) => (r.assignees ?? []).map((a) => a.user_id))),
  );
  let profileMap = new Map<string, AssigneeProfile>();
  if (userIds.length) {
    const { data: profiles } = await sb
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', userIds);
    profileMap = new Map(
      (profiles ?? []).map((p) => [p.user_id, p as AssigneeProfile]),
    );
  }
  return rows.map((row) => ({
    ...row,
    assignees: (row.assignees ?? []).map((a) => ({
      user_id: a.user_id,
      profile: profileMap.get(a.user_id) ?? null,
    })),
  }));
}

export async function listAreas(opts: { includeArchived?: boolean } = {}) {
  const sb = await createClient();
  let q = sb
    .from('internal_areas')
    .select('id, name, description, color, archived_at')
    .order('name');
  if (!opts.includeArchived) q = q.is('archived_at', null);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listTasks(
  filter: {
    areaId?: string;
    status?: string;
    assigneeId?: string;
    projectId?: string;
  } = {},
): Promise<InternalTaskWithAssignees[]> {
  const sb = await createClient();
  let q = sb
    .from('internal_tasks')
    .select(
      'id, area_id, project_id, title, description, status, priority, due_date, ' +
      'created_at, updated_at, archived_at, ' +
      'assignees:internal_task_assignees!internal_task_assignees_task_id_fkey(user_id)',
    )
    .is('archived_at', null)
    .order('updated_at', { ascending: false });
  if (filter.areaId) q = q.eq('area_id', filter.areaId);
  if (filter.status) q = q.eq('status', filter.status);
  if (filter.projectId) q = q.eq('project_id', filter.projectId);
  const { data, error } = await q;
  if (error) throw error;
  // supabase-js generated types don't include the reverse `internal_tasks` →
  // `internal_task_assignees` relation (PostgREST resolves it at runtime via
  // the assignees-side FK), so we cast through `unknown` to the row shape we
  // explicitly typed above. The select string is validated at runtime.
  let rows = (data ?? []) as unknown as RawTaskRow[];
  if (filter.assigneeId) {
    rows = rows.filter((r) =>
      (r.assignees ?? []).some((a) => a.user_id === filter.assigneeId),
    );
  }
  return hydrateAssigneeProfiles(sb, rows);
}

export async function getTask(
  taskId: string,
): Promise<InternalTaskWithAssignees | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .from('internal_tasks')
    .select(
      'id, area_id, project_id, title, description, status, priority, due_date, ' +
      'created_at, updated_at, archived_at, ' +
      'assignees:internal_task_assignees!internal_task_assignees_task_id_fkey(user_id)',
    )
    .eq('id', taskId)
    .single();
  if (error || !data) return null;
  // See note in `listTasks` re: the unknown cast.
  const [hydrated] = await hydrateAssigneeProfiles(sb, [
    data as unknown as RawTaskRow,
  ]);
  return hydrated ?? null;
}
