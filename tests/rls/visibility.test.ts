import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, clientAs, createTestUser, cleanupTestData } from './setup';

describe('activity visibility RLS', () => {
  afterAll(async () => { await cleanupTestData(); });

  it('hides internal activities from clients', async () => {
    const admin = adminClient();
    const clientEmail = `vis-client-${Date.now()}@example.com`;
    const clientId = await createTestUser('client', clientEmail);

    const { data: org } = await admin
      .from('clients').insert({ name: 'Org A (rlstest)' }).select('id').single();
    const { data: project } = await admin
      .from('projects')
      .insert({ name: 'Visibility Test', code: `VIS-${Date.now()}`, client_id: org!.id })
      .select('id').single();
    await admin.from('project_members')
      .insert({ project_id: project!.id, user_id: clientId, project_role: 'viewer' });

    const { data: phase } = await admin
      .from('phases')
      .insert({ project_id: project!.id, name: 'P1' })
      .select('id').single();

    await admin.from('activities').insert([
      { phase_id: phase!.id, name: 'Public A', order_index: 0, visibility: 'client_visible' },
      { phase_id: phase!.id, name: 'Internal A', order_index: 1, visibility: 'internal' },
    ]);

    const sb = await clientAs(clientEmail);
    const { data: visible } = await sb
      .from('activities').select('name, visibility').eq('phase_id', phase!.id);
    const names = (visible ?? []).map((a) => a.name);
    expect(names).toContain('Public A');
    expect(names).not.toContain('Internal A');
  });
});
