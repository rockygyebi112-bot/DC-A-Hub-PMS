import 'server-only';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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

/**
 * Resolve display name/avatar for a set of user ids with the service client.
 * The `profiles` RLS policy only exposes self / admin / shared-project rows
 * (migration 0017), so two staff who share an internal TASK but no PROJECT
 * can't read each other via the user-scoped client — names would fall back to
 * raw user ids. Every caller here is already gated to admin/staff and we only
 * read non-sensitive name/avatar for users tied to internal work, so the
 * bypass is safe and scoped.
 */
async function fetchProfileMap(
  userIds: Iterable<string>,
): Promise<Map<string, AssigneeProfile>> {
  const ids = Array.from(new Set([...userIds].filter(Boolean)));
  if (!ids.length) return new Map();
  const admin = createServiceClient();
  const { data } = await admin
    .from('profiles')
    .select('user_id, full_name, avatar_url')
    .in('user_id', ids);
  return new Map((data ?? []).map((p) => [p.user_id, p as AssigneeProfile]));
}

async function hydrateAssigneeProfiles(
  rows: RawTaskRow[],
): Promise<InternalTaskWithAssignees[]> {
  const profileMap = await fetchProfileMap(
    rows.flatMap((r) => (r.assignees ?? []).map((a) => a.user_id)),
  );
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
  const base = () => {
    const q = sb
      .from('internal_areas')
      .select('id, name, description, color, archived_at');
    return opts.includeArchived ? q : q.is('archived_at', null);
  };
  // Prefer explicit section order (migration 0046). Fall back to name ordering
  // if the `position` column isn't there yet, so the workspace keeps working
  // before the migration is applied.
  let { data, error } = await base()
    .order('position', { ascending: true })
    .order('name');
  if (error) {
    ({ data, error } = await base().order('name'));
  }
  if (error) throw error;
  return data ?? [];
}

const TASK_SELECT =
  'id, area_id, project_id, title, description, status, priority, due_date, ' +
  'created_at, updated_at, archived_at, ' +
  'assignees:internal_task_assignees!internal_task_assignees_task_id_fkey(user_id)';

export async function listTasks(
  filter: {
    areaId?: string;
    status?: string;
    assigneeId?: string;
    projectId?: string;
  } = {},
): Promise<InternalTaskWithAssignees[]> {
  const sb = await createClient();
  const build = (excludeSubtasks: boolean) => {
    let q = sb
      .from('internal_tasks')
      .select(TASK_SELECT)
      .is('archived_at', null)
      .order('updated_at', { ascending: false });
    // Subtasks (parent_task_id set) only show on the parent's detail page, never
    // in the board/list. The column is added by migration 0048; fall back to an
    // unfiltered query if it isn't there yet (no subtasks exist pre-migration).
    if (excludeSubtasks) q = q.is('parent_task_id', null);
    if (filter.areaId) q = q.eq('area_id', filter.areaId);
    if (filter.status) q = q.eq('status', filter.status);
    if (filter.projectId) q = q.eq('project_id', filter.projectId);
    return q;
  };
  let { data, error } = await build(true);
  if (error) ({ data, error } = await build(false));
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
  return hydrateAssigneeProfiles(rows);
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
  const [hydrated] = await hydrateAssigneeProfiles([
    data as unknown as RawTaskRow,
  ]);
  return hydrated ?? null;
}

export type InternalSubtask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
};

/**
 * Child tasks of a parent, oldest first. Returns an empty list (rather than
 * throwing) if migration 0048 hasn't added `parent_task_id` yet, so the detail
 * page keeps working before the migration is applied.
 */
export async function listSubtasks(parentId: string): Promise<InternalSubtask[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from('internal_tasks')
    .select('id, title, status, due_date')
    .eq('parent_task_id', parentId)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as InternalSubtask[];
}

// ---------- documents + comments (0045) ----------

export type InternalProof = {
  id: string;
  task_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploaderName: string | null;
};

export type InternalComment = {
  id: string;
  body: string;
  author_user_id: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  created_at: string;
};

type ProofRow = Omit<InternalProof, 'uploaderName'>;
type CommentRow = {
  id: string;
  body: string;
  author_user_id: string;
  created_at: string;
};

/** Documents attached to an internal task, newest first. */
export async function listInternalTaskProofs(
  taskId: string,
): Promise<InternalProof[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from('internal_task_proofs')
    .select(
      'id, task_id, file_path, file_name, mime_type, size_bytes, caption, uploaded_by, created_at',
    )
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ProofRow[];
  const profileMap = await fetchProfileMap(rows.map((r) => r.uploaded_by ?? ''));
  return rows.map((r) => ({
    ...r,
    uploaderName: r.uploaded_by
      ? profileMap.get(r.uploaded_by)?.full_name ?? null
      : null,
  }));
}

/** Task-level discussion feed, oldest first (chronological). */
export async function listInternalTaskComments(
  taskId: string,
): Promise<InternalComment[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from('internal_task_comments')
    .select('id, body, author_user_id, created_at')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return hydrateComments((data ?? []) as CommentRow[]);
}

/**
 * Per-document comment threads for every proof on a task, keyed by proof id.
 * Fetched in one round-trip so the page can hand each document its thread.
 */
export async function listInternalProofComments(
  proofIds: string[],
): Promise<Record<string, InternalComment[]>> {
  const grouped: Record<string, InternalComment[]> = {};
  if (proofIds.length === 0) return grouped;
  const sb = await createClient();
  const { data, error } = await sb
    .from('internal_task_proof_comments')
    .select('id, proof_id, body, author_user_id, created_at')
    .in('proof_id', proofIds)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as (CommentRow & { proof_id: string })[];
  const hydrated = await hydrateComments(rows);
  rows.forEach((row, i) => {
    (grouped[row.proof_id] ??= []).push(hydrated[i]);
  });
  return grouped;
}

async function hydrateComments(rows: CommentRow[]): Promise<InternalComment[]> {
  const profileMap = await fetchProfileMap(rows.map((r) => r.author_user_id));
  return rows.map((r) => {
    const p = profileMap.get(r.author_user_id);
    return {
      id: r.id,
      body: r.body,
      author_user_id: r.author_user_id,
      authorName: p?.full_name ?? null,
      authorAvatarUrl: p?.avatar_url ?? null,
      created_at: r.created_at,
    };
  });
}
