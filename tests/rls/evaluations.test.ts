import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, clientAs, createTestUser, cleanupTestData } from './setup';

afterAll(async () => { await cleanupTestData(); });

describe('evaluations core tables', () => {
  it('evaluations / evaluation_instruments / evaluation_dashboard_configs exist', async () => {
    const admin = adminClient();
    const a = await admin.from('evaluations').select('id').limit(1);
    const b = await admin.from('evaluation_instruments').select('id').limit(1);
    const c = await admin.from('evaluation_dashboard_configs').select('id').limit(1);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(c.error).toBeNull();
  });

  it('mis_investments / evaluation_responses / evaluation_response_investments exist', async () => {
    const admin = adminClient();
    const a = await admin.from('mis_investments').select('id').limit(1);
    const b = await admin.from('evaluation_responses').select('id').limit(1);
    const c = await admin.from('evaluation_response_investments').select('id').limit(1);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(c.error).toBeNull();
  });
});

describe('evaluations RLS', () => {
  it('client sees only approved responses for their project', async () => {
    const admin = adminClient();
    const clientEmail = `ev-client-${Date.now()}@example.com`;
    const clientId = await createTestUser('client', clientEmail);

    const { data: org } = await admin
      .from('clients').insert({ name: 'Org RLS Eval' }).select('id').single();
    const { data: project } = await admin
      .from('projects')
      .insert({ name: 'Eval Proj', code: `EV-${Date.now()}`, client_id: org!.id })
      .select('id').single();
    await admin.from('project_members')
      .insert({ project_id: project!.id, user_id: clientId, project_role: 'viewer' });

    const { data: ev } = await admin
      .from('evaluations')
      .insert({ project_id: project!.id, name: 'E', slug: `e-${Date.now()}` })
      .select('id').single();
    const { data: inst } = await admin
      .from('evaluation_instruments')
      .insert({ evaluation_id: ev!.id, kind: 'hh', name: 'HH', kobo_form_id: 'f1' })
      .select('id').single();
    await admin.from('evaluation_responses').insert([
      { instrument_id: inst!.id, kobo_submission_uuid: 'u1', submitted_at: new Date().toISOString(), raw: {}, qc_status: 'approved' },
      { instrument_id: inst!.id, kobo_submission_uuid: 'u2', submitted_at: new Date().toISOString(), raw: {}, qc_status: 'pending' },
    ]);

    const sb = await clientAs(clientEmail);
    const { data: visible } = await sb
      .from('evaluation_responses')
      .select('kobo_submission_uuid, qc_status')
      .eq('instrument_id', inst!.id);
    const uuids = (visible ?? []).map((r) => r.kobo_submission_uuid);
    expect(uuids).toContain('u1');
    expect(uuids).not.toContain('u2');
  });

  it('client cannot read mis_investments or ingestion tables', async () => {
    const admin = adminClient();
    const clientEmail = `ev-client2-${Date.now()}@example.com`;
    await createTestUser('client', clientEmail);
    const sb = await clientAs(clientEmail);
    const a = await sb.from('mis_investments').select('id').limit(1);
    const b = await sb.from('evaluation_ingestion_runs').select('id').limit(1);
    const c = await sb.from('evaluation_ingestion_issues').select('id').limit(1);
    expect((a.data ?? []).length).toBe(0);
    expect((b.data ?? []).length).toBe(0);
    expect((c.data ?? []).length).toBe(0);
  });
});
