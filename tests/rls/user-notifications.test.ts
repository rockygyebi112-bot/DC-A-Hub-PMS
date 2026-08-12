import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, clientAs, createTestUser, cleanupTestData } from './setup';

afterAll(async () => { await cleanupTestData(); });

describe('user_notifications RLS', () => {
  it('a user reads only their own notifications', async () => {
    const admin = adminClient();
    const aEmail = `un-a-${Date.now()}@example.com`;
    const bEmail = `un-b-${Date.now()}@example.com`;
    const aId = await createTestUser('staff', aEmail);
    const bId = await createTestUser('staff', bEmail);

    await admin.from('user_notifications').insert([
      { user_id: aId, type: 'internal_task_assigned', title: 'Task for A' },
      { user_id: bId, type: 'internal_task_assigned', title: 'Task for B' },
    ]);

    const sbA = await clientAs(aEmail);
    const { data } = await sbA.from('user_notifications').select('title');
    const titles = (data ?? []).map((r) => r.title);
    expect(titles).toContain('Task for A');
    expect(titles).not.toContain('Task for B');
  }, 30_000);

  it('a user cannot insert a notification for someone else', async () => {
    const aEmail = `un-ins-a-${Date.now()}@example.com`;
    const bEmail = `un-ins-b-${Date.now()}@example.com`;
    await createTestUser('staff', aEmail);
    const bId = await createTestUser('staff', bEmail);

    const sbA = await clientAs(aEmail);
    const { error } = await sbA.from('user_notifications').insert({
      user_id: bId, type: 'internal_task_assigned', title: 'Injected',
    });
    expect(error).not.toBeNull();
  }, 30_000);
});
