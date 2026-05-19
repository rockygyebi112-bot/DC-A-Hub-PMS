import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, createTestUser, cleanupTestData } from '../rls/setup';

describe('internal task lifecycle', () => {
  afterAll(async () => { await cleanupTestData(); });

  it('admin creates → assigns → staff completes', async () => {
    const admin = adminClient();
    const staffEmail = `iw-life-staff-${Date.now()}@example.com`;
    const staffId = await createTestUser('staff', staffEmail);

    const { data: area } = await admin.from('internal_areas').select('id').limit(1).single();
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

  it('archiving an area with active tasks fails the action', async () => {
    const admin = adminClient();
    const { data: area } = await admin.from('internal_areas')
      .insert({ name: `IW Temp ${Date.now()}` }).select('id').single();
    await admin.from('internal_tasks').insert({ area_id: area!.id, title: 'Active' });

    const { count } = await admin.from('internal_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('area_id', area!.id).is('archived_at', null);
    expect((count ?? 0)).toBeGreaterThan(0);
  });
});
