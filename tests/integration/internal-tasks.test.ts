import { afterAll, describe, expect, it } from 'vitest';
import {
  adminClient,
  createTestUser,
  cleanupTestData,
  deleteInternalAreas,
} from '../rls/setup';
import {
  archiveAreaWithTasks,
  archiveTaskTree,
  countActiveAreaTasks,
  restoreAreaWithTasks,
  restoreTaskTree,
} from '@/lib/internal/archive';

describe('internal task lifecycle', () => {
  // Areas this file creates; cleaned up by id so a concurrent test file's
  // afterAll never deletes our in-flight fixtures.
  const createdAreaIds: string[] = [];
  afterAll(async () => {
    await deleteInternalAreas(createdAreaIds);
    await cleanupTestData();
  });

  it('admin creates → assigns → staff completes', async () => {
    const admin = adminClient();
    const staffEmail = `iw-life-staff-${Date.now()}@example.com`;
    const staffId = await createTestUser('staff', staffEmail);

    const { data: area } = await admin.from('internal_areas')
      .insert({ name: `IW Temp ${Date.now()}` })
      .select('id').single();
    createdAreaIds.push(area!.id);
    const { data: task } = await admin.from('internal_tasks')
      .insert({ area_id: area!.id, title: 'Quarterly BD review' })
      .select('id').single();
    await admin.from('internal_task_assignees')
      .insert({ task_id: task!.id, user_id: staffId });

    const { error: updErr } = await admin
      .from('internal_tasks').update({ status: 'done' }).eq('id', task!.id);
    expect(updErr).toBeNull();

    const { data: after } = await admin.from('internal_tasks')
      .select('status').eq('id', task!.id).single();
    expect(after?.status).toBe('done');
  });

  it('archiving an area archives its tasks and subtasks with it', async () => {
    const admin = adminClient();
    const { data: area } = await admin.from('internal_areas')
      .insert({ name: `IW Temp ${Date.now()}` }).select('id').single();
    createdAreaIds.push(area!.id);
    const { data: task } = await admin.from('internal_tasks')
      .insert({ area_id: area!.id, title: 'Active' }).select('id').single();
    const { data: subtask } = await admin.from('internal_tasks')
      .insert({ area_id: area!.id, title: 'Child', parent_task_id: task!.id })
      .select('id').single();

    const result = await archiveAreaWithTasks(admin, area!.id);
    expect(result.ok).toBe(true);

    const { data: archivedArea } = await admin.from('internal_areas')
      .select('archived_at').eq('id', area!.id).single();
    const { data: rows } = await admin.from('internal_tasks')
      .select('id, archived_at').in('id', [task!.id, subtask!.id]);

    expect(archivedArea?.archived_at).not.toBeNull();
    // One shared stamp is what makes restore able to undo exactly this action.
    for (const row of rows ?? []) {
      expect(row.archived_at).toBe(archivedArea!.archived_at);
    }
  });

  it('restoring an area brings back only what the archive took', async () => {
    const admin = adminClient();
    const { data: area } = await admin.from('internal_areas')
      .insert({ name: `IW Temp ${Date.now()}` }).select('id').single();
    createdAreaIds.push(area!.id);
    const { data: active } = await admin.from('internal_tasks')
      .insert({ area_id: area!.id, title: 'Swept up' }).select('id').single();
    // Archived by hand beforehand: it must stay archived through the restore.
    const { data: preArchived } = await admin.from('internal_tasks')
      .insert({
        area_id: area!.id,
        title: 'Archived earlier',
        archived_at: new Date('2020-01-01').toISOString(),
      })
      .select('id').single();

    await archiveAreaWithTasks(admin, area!.id);
    const result = await restoreAreaWithTasks(admin, area!.id);
    expect(result.ok).toBe(true);

    const { data: areaAfter } = await admin.from('internal_areas')
      .select('archived_at').eq('id', area!.id).single();
    const { data: activeAfter } = await admin.from('internal_tasks')
      .select('archived_at').eq('id', active!.id).single();
    const { data: preAfter } = await admin.from('internal_tasks')
      .select('archived_at').eq('id', preArchived!.id).single();

    expect(areaAfter?.archived_at).toBeNull();
    expect(activeAfter?.archived_at).toBeNull();
    expect(preAfter?.archived_at).not.toBeNull();
  });

  it('re-archiving an already archived area keeps one group', async () => {
    const admin = adminClient();
    const { data: area } = await admin.from('internal_areas')
      .insert({ name: `IW Temp ${Date.now()}` }).select('id').single();
    createdAreaIds.push(area!.id);
    const { data: first } = await admin.from('internal_tasks')
      .insert({ area_id: area!.id, title: 'First' }).select('id').single();

    await archiveAreaWithTasks(admin, area!.id);
    // Stands in for a retry after a partially applied archive: the second task
    // must join the existing group, not start a new one that restore misses.
    const { data: late } = await admin.from('internal_tasks')
      .insert({ area_id: area!.id, title: 'Added late' }).select('id').single();
    await archiveAreaWithTasks(admin, area!.id);

    const { data: areaRow } = await admin.from('internal_areas')
      .select('archived_at').eq('id', area!.id).single();
    const { data: rows } = await admin.from('internal_tasks')
      .select('archived_at').in('id', [first!.id, late!.id]);
    for (const row of rows ?? []) {
      expect(row.archived_at).toBe(areaRow!.archived_at);
    }

    await restoreAreaWithTasks(admin, area!.id);
    const { data: after } = await admin.from('internal_tasks')
      .select('archived_at').in('id', [first!.id, late!.id]);
    for (const row of after ?? []) expect(row.archived_at).toBeNull();
  });

  it('archiving a task takes its subtasks and restoring returns them', async () => {
    const admin = adminClient();
    const { data: area } = await admin.from('internal_areas')
      .insert({ name: `IW Temp ${Date.now()}` }).select('id').single();
    createdAreaIds.push(area!.id);
    const { data: parent } = await admin.from('internal_tasks')
      .insert({ area_id: area!.id, title: 'Parent' }).select('id').single();
    const { data: child } = await admin.from('internal_tasks')
      .insert({ area_id: area!.id, title: 'Child', parent_task_id: parent!.id })
      .select('id').single();

    expect((await archiveTaskTree(admin, parent!.id)).ok).toBe(true);
    const { data: archived } = await admin.from('internal_tasks')
      .select('id, archived_at').in('id', [parent!.id, child!.id]);
    expect(archived?.every((r) => r.archived_at !== null)).toBe(true);

    expect((await restoreTaskTree(admin, parent!.id)).ok).toBe(true);
    const { data: restored } = await admin.from('internal_tasks')
      .select('id, archived_at').in('id', [parent!.id, child!.id]);
    expect(restored?.every((r) => r.archived_at === null)).toBe(true);
  });

  it('counts only the active tasks in a section', async () => {
    const admin = adminClient();
    const { data: area } = await admin.from('internal_areas')
      .insert({ name: `IW Temp ${Date.now()}` }).select('id').single();
    createdAreaIds.push(area!.id);
    await admin.from('internal_tasks').insert([
      { area_id: area!.id, title: 'One' },
      { area_id: area!.id, title: 'Two' },
      { area_id: area!.id, title: 'Gone', archived_at: new Date().toISOString() },
    ]);

    const result = await countActiveAreaTasks(admin, area!.id);
    expect(result.ok && result.data?.count).toBe(2);
  });
});
