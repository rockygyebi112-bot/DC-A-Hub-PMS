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

  it('hides proofs of internal activities from clients', async () => {
    const admin = adminClient();
    const clientEmail = `vis-proof-client-${Date.now()}@example.com`;
    const clientId = await createTestUser('client', clientEmail);

    const { data: org } = await admin.from('clients').insert({ name: 'Org A (rlstest)' }).select('id').single();
    const { data: project } = await admin
      .from('projects').insert({ name: 'Proof Vis', code: `VIS-P-${Date.now()}`, client_id: org!.id })
      .select('id').single();
    await admin.from('project_members')
      .insert({ project_id: project!.id, user_id: clientId, project_role: 'viewer' });
    const { data: phase } = await admin.from('phases')
      .insert({ project_id: project!.id, name: 'P1' }).select('id').single();
    const { data: acts } = await admin.from('activities').insert([
      { phase_id: phase!.id, name: 'Public A', order_index: 0, visibility: 'client_visible' },
      { phase_id: phase!.id, name: 'Internal A', order_index: 1, visibility: 'internal' },
    ]).select('id, name');
    const internal = acts!.find((a) => a.name === 'Internal A')!;
    const pub = acts!.find((a) => a.name === 'Public A')!;
    await admin.from('activity_proofs').insert([
      { activity_id: pub.id, file_path: 'a.pdf', file_name: 'a.pdf' },
      { activity_id: internal.id, file_path: 'b.pdf', file_name: 'b.pdf' },
    ]);

    const sb = await clientAs(clientEmail);
    const { data: proofs } = await sb.from('activity_proofs')
      .select('file_name, activity:activities(name)');
    const files = (proofs ?? []).map((p) => p.file_name);
    expect(files).toContain('a.pdf');
    expect(files).not.toContain('b.pdf');
  });
});
