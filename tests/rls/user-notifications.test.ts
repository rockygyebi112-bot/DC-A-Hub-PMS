import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, clientAs, createTestUser, deleteTestUsers } from './setup';

const createdUserIds: string[] = [];
afterAll(async () => { await deleteTestUsers(createdUserIds); });

describe('user_notifications RLS', () => {
  it('a user reads only their own notifications', async () => {
    const admin = adminClient();
    const stamp = Date.now();
    const aEmail = `un-a-${stamp}@example.com`;
    const bEmail = `un-b-${stamp}@example.com`;
    const aId = await createTestUser('staff', aEmail);
    const bId = await createTestUser('staff', bEmail);
    createdUserIds.push(aId, bId);

    const { error: seedError } = await admin.from('user_notifications').insert([
      { user_id: aId, type: 'internal_task_assigned', title: `Task for A ${stamp}` },
      { user_id: bId, type: 'internal_task_assigned', title: `Task for B ${stamp}` },
    ]);
    expect(seedError).toBeNull();

    const sbA = await clientAs(aEmail);
    const { data, error: readError } = await sbA.from('user_notifications').select('title');
    expect(readError).toBeNull();
    const titles = (data ?? []).map((r) => r.title);
    expect(titles).toContain(`Task for A ${stamp}`);
    expect(titles).not.toContain(`Task for B ${stamp}`);
  }, 30_000);

  it('a user cannot insert a notification for someone else, or for themselves', async () => {
    const stamp = Date.now();
    const aEmail = `un-ins-a-${stamp}@example.com`;
    const bEmail = `un-ins-b-${stamp}@example.com`;
    const aId = await createTestUser('staff', aEmail);
    const bId = await createTestUser('staff', bEmail);
    createdUserIds.push(aId, bId);

    const sbA = await clientAs(aEmail);

    const { error: forOtherError } = await sbA.from('user_notifications').insert({
      user_id: bId, type: 'internal_task_assigned', title: `Injected ${stamp}`,
    });
    expect(forOtherError?.code).toBe('42501');

    // The design guarantee is "no insert policy at all — service-role writes
    // only," not merely "can't insert for others." A self-insert must be
    // denied the same way, or a future `user_id = auth.uid()` insert policy
    // would silently break that guarantee.
    const { error: forSelfError } = await sbA.from('user_notifications').insert({
      user_id: aId, type: 'internal_task_assigned', title: `Self-insert ${stamp}`,
    });
    expect(forSelfError?.code).toBe('42501');
  }, 30_000);
});
