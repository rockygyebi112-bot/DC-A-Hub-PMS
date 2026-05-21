import { afterAll, describe, expect, it } from 'vitest';
import {
  adminClient,
  clientAs,
  createTestUser,
  cleanupTestData,
  deleteInternalAreas,
} from './setup';

describe('internal workspace RLS', () => {
  // Areas this file creates; cleaned up by id so a concurrent test file's
  // afterAll never deletes our in-flight fixtures.
  const createdAreaIds: string[] = [];
  afterAll(async () => {
    await deleteInternalAreas(createdAreaIds);
    await cleanupTestData();
  });

  it('client role cannot see any internal_tasks or internal_areas', async () => {
    const admin = adminClient();
    const clientEmail = `iw-client-${Date.now()}@example.com`;
    await createTestUser('client', clientEmail);

    const { data: area } = await admin
      .from('internal_areas')
      .insert({ name: `IW Temp ${Date.now()}` })
      .select('id').single();
    createdAreaIds.push(area!.id);
    await admin.from('internal_tasks').insert({
      area_id: area!.id, title: 'Hidden BD work',
    });

    const sb = await clientAs(clientEmail);
    const tasksRes = await sb.from('internal_tasks').select('id');
    expect(tasksRes.data ?? []).toEqual([]);
    const areasRes = await sb.from('internal_areas').select('id');
    expect(areasRes.data ?? []).toEqual([]);
  });

  it('staff only sees internal_tasks they are assigned to', async () => {
    const admin = adminClient();
    const staffAEmail = `iw-staff-a-${Date.now()}@example.com`;
    const staffBEmail = `iw-staff-b-${Date.now()}@example.com`;
    const staffAId = await createTestUser('staff', staffAEmail);
    await createTestUser('staff', staffBEmail);

    const { data: area } = await admin.from('internal_areas')
      .insert({ name: `IW Temp ${Date.now()}` })
      .select('id').single();
    createdAreaIds.push(area!.id);
    const { data: t1 } = await admin.from('internal_tasks')
      .insert({ area_id: area!.id, title: 'Assigned to A' }).select('id').single();
    const { data: t2 } = await admin.from('internal_tasks')
      .insert({ area_id: area!.id, title: 'Assigned to nobody' }).select('id').single();
    await admin.from('internal_task_assignees')
      .insert({ task_id: t1!.id, user_id: staffAId });

    const sbA = await clientAs(staffAEmail);
    const aRes = await sbA.from('internal_tasks').select('id, title');
    const titles = (aRes.data ?? []).map((r) => r.title);
    expect(titles).toContain('Assigned to A');
    expect(titles).not.toContain('Assigned to nobody');

    const sbB = await clientAs(staffBEmail);
    const bRes = await sbB.from('internal_tasks').select('id, title');
    expect(bRes.data ?? []).toEqual([]);
  });

  it('admin sees all internal_tasks', async () => {
    const admin = adminClient();
    const adminEmail = `iw-admin-${Date.now()}@example.com`;
    await createTestUser('admin', adminEmail);

    const sb = await clientAs(adminEmail);
    const { data } = await sb.from('internal_tasks').select('id');
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
