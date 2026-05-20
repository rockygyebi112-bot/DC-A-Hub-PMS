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
  }, 30_000);

  it('mis_investments / evaluation_responses / evaluation_response_investments exist', async () => {
    const admin = adminClient();
    const a = await admin.from('mis_investments').select('id').limit(1);
    const b = await admin.from('evaluation_responses').select('id').limit(1);
    const c = await admin.from('evaluation_response_investments').select('id').limit(1);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(c.error).toBeNull();
  }, 30_000);
});

describe('evaluations RLS', () => {
  it('client sees only approved responses for their project', async () => {
    const admin = adminClient();
    const clientEmail = `ev-client-${Date.now()}@example.com`;
    const clientId = await createTestUser('client', clientEmail);

    const { data: org } = await admin
      .from('clients').insert({ name: `PM-Test Org RLS Eval ${Date.now()}` }).select('id').single();
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
  }, 30_000);

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
  }, 30_000);

  // Client names use the `PM-Test %` pattern so cleanupTestData() sweeps them
  // (and the cascaded projects/evaluations/responses).
  it('staff sees all responses for projects they belong to', async () => {
    const admin = adminClient();
    const staffEmail = `ev-staff-${Date.now()}@example.com`;
    const staffId = await createTestUser('staff', staffEmail);
    const { data: org } = await admin.from('clients')
      .insert({ name: `PM-Test Org Staff ${Date.now()}` }).select('id').single();
    const { data: project } = await admin.from('projects')
      .insert({ name: 'Staff Eval', code: `EVSF-${Date.now()}`, client_id: org!.id })
      .select('id').single();
    await admin.from('project_members')
      .insert({ project_id: project!.id, user_id: staffId, project_role: 'manager' });
    const { data: ev } = await admin.from('evaluations')
      .insert({ project_id: project!.id, name: 'E', slug: `staff-${Date.now()}` })
      .select('id').single();
    const { data: inst } = await admin.from('evaluation_instruments')
      .insert({ evaluation_id: ev!.id, kind: 'hh', name: 'HH', kobo_form_id: 'f' })
      .select('id').single();
    await admin.from('evaluation_responses').insert([
      { instrument_id: inst!.id, kobo_submission_uuid: 'p1', submitted_at: new Date().toISOString(), raw: {}, qc_status: 'pending' },
      { instrument_id: inst!.id, kobo_submission_uuid: 'a1', submitted_at: new Date().toISOString(), raw: {}, qc_status: 'approved' },
    ]);
    const sb = await clientAs(staffEmail);
    const { data } = await sb.from('evaluation_responses')
      .select('kobo_submission_uuid').eq('instrument_id', inst!.id);
    const uuids = (data ?? []).map((r) => r.kobo_submission_uuid);
    expect(uuids).toContain('p1');
    expect(uuids).toContain('a1');
  }, 30_000);

  it('staff can update qc_status; client cannot', async () => {
    const admin = adminClient();
    const staffEmail = `ev-staff-up-${Date.now()}@example.com`;
    const clientEmail = `ev-client-up-${Date.now()}@example.com`;
    const staffId = await createTestUser('staff', staffEmail);
    const clientId = await createTestUser('client', clientEmail);
    const { data: org } = await admin.from('clients')
      .insert({ name: `PM-Test Org Up ${Date.now()}` }).select('id').single();
    const { data: project } = await admin.from('projects')
      .insert({ name: 'Eval Up', code: `EVUP-${Date.now()}`, client_id: org!.id })
      .select('id').single();
    await admin.from('project_members').insert([
      { project_id: project!.id, user_id: staffId, project_role: 'manager' },
      { project_id: project!.id, user_id: clientId, project_role: 'viewer' },
    ]);
    const { data: ev } = await admin.from('evaluations')
      .insert({ project_id: project!.id, name: 'E', slug: `up-${Date.now()}` })
      .select('id').single();
    const { data: inst } = await admin.from('evaluation_instruments')
      .insert({ evaluation_id: ev!.id, kind: 'hh', name: 'HH', kobo_form_id: 'f' })
      .select('id').single();
    const { data: resp } = await admin.from('evaluation_responses')
      .insert({ instrument_id: inst!.id, kobo_submission_uuid: 'qc-1',
                submitted_at: new Date().toISOString(), raw: {}, qc_status: 'pending' })
      .select('id').single();

    const sStaff = await clientAs(staffEmail);
    const upStaff = await sStaff.from('evaluation_responses').update({ qc_status: 'approved' }).eq('id', resp!.id);
    expect(upStaff.error).toBeNull();

    const sClient = await clientAs(clientEmail);
    await sClient.from('evaluation_responses').update({ qc_status: 'pending' }).eq('id', resp!.id);
    // RLS denies the update — either error or zero rows affected. Both are acceptable.
    // Re-read should still be 'approved'.
    const after = await admin.from('evaluation_responses').select('qc_status').eq('id', resp!.id).single();
    expect(after.data?.qc_status).toBe('approved');
  }, 30_000);

  it('non-member client cannot read evaluations in other projects', async () => {
    const admin = adminClient();
    const outsiderEmail = `ev-outsider-${Date.now()}@example.com`;
    await createTestUser('client', outsiderEmail);
    const { data: org } = await admin.from('clients')
      .insert({ name: `PM-Test Org X ${Date.now()}` }).select('id').single();
    const { data: project } = await admin.from('projects')
      .insert({ name: 'Stranger', code: `STR-${Date.now()}`, client_id: org!.id })
      .select('id').single();
    await admin.from('evaluations').insert({ project_id: project!.id, name: 'E', slug: `str-${Date.now()}` });
    const sb = await clientAs(outsiderEmail);
    const { data } = await sb.from('evaluations').select('id').eq('project_id', project!.id);
    expect((data ?? []).length).toBe(0);
  }, 30_000);
});
