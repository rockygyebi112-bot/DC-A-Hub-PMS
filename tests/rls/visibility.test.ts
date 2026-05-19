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

    const { data: bare } = await sb
      .from('activity_proofs')
      .select('file_name, activity_id')
      .in('activity_id', [pub.id, internal.id]);
    const bareFiles = (bare ?? []).map((p) => p.file_name);
    expect(bareFiles).toContain('a.pdf');
    expect(bareFiles).not.toContain('b.pdf');
  });

  it('hides comments on proofs of internal activities from clients', async () => {
    const admin = adminClient();
    const clientEmail = `vis-comment-client-${Date.now()}@example.com`;
    const clientId = await createTestUser('client', clientEmail);

    const { data: org } = await admin.from('clients').insert({ name: 'Org A (rlstest)' }).select('id').single();
    const { data: project } = await admin
      .from('projects').insert({ name: 'Comment Vis', code: `VIS-C-${Date.now()}`, client_id: org!.id })
      .select('id').single();
    await admin.from('project_members')
      .insert({ project_id: project!.id, user_id: clientId, project_role: 'viewer' });
    const { data: phase } = await admin.from('phases')
      .insert({ project_id: project!.id, name: 'P1' }).select('id').single();
    const { data: acts } = await admin.from('activities').insert([
      { phase_id: phase!.id, name: 'Public A', visibility: 'client_visible', order_index: 0 },
      { phase_id: phase!.id, name: 'Internal A', visibility: 'internal', order_index: 1 },
    ]).select('id, name');
    const pub = acts!.find((a) => a.name === 'Public A')!;
    const internal = acts!.find((a) => a.name === 'Internal A')!;
    const { data: proofs } = await admin.from('activity_proofs').insert([
      { activity_id: pub.id, file_path: 'a.pdf', file_name: 'a.pdf' },
      { activity_id: internal.id, file_path: 'b.pdf', file_name: 'b.pdf' },
    ]).select('id, activity_id');
    const pubProof = proofs!.find((p) => p.activity_id === pub.id)!;
    const internalProof = proofs!.find((p) => p.activity_id === internal.id)!;

    await admin.from('proof_comments').insert([
      { proof_id: pubProof.id, author_user_id: clientId, body: 'on public' },
      { proof_id: internalProof.id, author_user_id: clientId, body: 'on internal' },
    ]);

    const sb = await clientAs(clientEmail);
    const { data: comments } = await sb
      .from('proof_comments').select('body, proof_id')
      .in('proof_id', [pubProof.id, internalProof.id]);
    const bodies = (comments ?? []).map((c) => c.body);
    expect(bodies).toContain('on public');
    expect(bodies).not.toContain('on internal');
  });

  it('hides access-log entries for proofs of internal activities from clients', async () => {
    const admin = adminClient();
    const clientEmail = `vis-access-client-${Date.now()}@example.com`;
    const clientId = await createTestUser('client', clientEmail);

    const { data: org } = await admin.from('clients').insert({ name: 'Org A (rlstest)' }).select('id').single();
    const { data: project } = await admin
      .from('projects').insert({ name: 'Access Vis', code: `VIS-A-${Date.now()}`, client_id: org!.id })
      .select('id').single();
    await admin.from('project_members')
      .insert({ project_id: project!.id, user_id: clientId, project_role: 'viewer' });
    const { data: phase } = await admin.from('phases')
      .insert({ project_id: project!.id, name: 'P1' }).select('id').single();
    const { data: acts } = await admin.from('activities').insert([
      { phase_id: phase!.id, name: 'Public A', visibility: 'client_visible', order_index: 0 },
      { phase_id: phase!.id, name: 'Internal A', visibility: 'internal', order_index: 1 },
    ]).select('id, name');
    const pub = acts!.find((a) => a.name === 'Public A')!;
    const internal = acts!.find((a) => a.name === 'Internal A')!;
    const { data: proofs } = await admin.from('activity_proofs').insert([
      { activity_id: pub.id, file_path: 'a.pdf', file_name: 'a.pdf' },
      { activity_id: internal.id, file_path: 'b.pdf', file_name: 'b.pdf' },
    ]).select('id, activity_id');
    const pubProof = proofs!.find((p) => p.activity_id === pub.id)!;
    const internalProof = proofs!.find((p) => p.activity_id === internal.id)!;

    await admin.from('proof_access_log').insert([
      { proof_id: pubProof.id, project_id: project!.id, user_id: clientId },
      { proof_id: internalProof.id, project_id: project!.id, user_id: clientId },
    ]);

    // Per the new 0031 policy, viewers should NEVER see access-log rows.
    // The pre-existing leak (via can_access_project on the old _member_read)
    // is now closed; we assert the viewer sees zero rows for these proofs.
    const sb = await clientAs(clientEmail);
    const { data: logs } = await sb
      .from('proof_access_log').select('id, proof_id')
      .in('proof_id', [pubProof.id, internalProof.id]);
    expect(logs ?? []).toEqual([]);
  });
});
