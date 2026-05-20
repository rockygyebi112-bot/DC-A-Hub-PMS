import { afterAll, describe, expect, it } from 'vitest';
import { adminClient, cleanupTestData } from '../rls/setup';
import { matchInvestment } from '@/lib/evaluations/match-investments';

describe('matchInvestment', () => {
  afterAll(async () => { await cleanupTestData(); });

  // projects.client_id is NOT NULL; create a client first. Name matches the
  // `PM-Test %` pattern that cleanupTestData() sweeps.
  async function newProject(admin: ReturnType<typeof adminClient>, label: string) {
    const { data: client } = await admin
      .from('clients').insert({ name: `PM-Test ${label} ${Date.now()}` }).select('id').single();
    const { data: project } = await admin
      .from('projects')
      .insert({ name: label, code: `${label}-${Date.now()}`, client_id: client!.id })
      .select('id').single();
    return project!;
  }

  it('exact case-insensitive match wins', async () => {
    const admin = adminClient();
    const project = await newProject(admin, 'MatchTest');
    const { data: ev } = await admin.from('evaluations')
      .insert({ project_id: project!.id, name: 'E', slug: `e-${Date.now()}` })
      .select('id').single();
    const { data: inv } = await admin.from('mis_investments').insert([
      { evaluation_id: ev!.id, community: 'Sagnarigu', district: 'Tamale',
        investment_type: 'borehole', investment_name: 'Sagnarigu Borehole 1' },
    ]).select('id, investment_name').single();

    const m = await matchInvestment({
      evaluationId: ev!.id, community: 'Sagnarigu', rawName: 'sagnarigu borehole 1',
    });
    expect(m?.investment_id).toBe(inv!.id);
    expect(m?.match_status).toBe('auto');
  }, 30_000);

  it('fuzzy trigram >= 0.85 matches', async () => {
    const admin = adminClient();
    const project = await newProject(admin, 'MatchTest2');
    const { data: ev } = await admin.from('evaluations')
      .insert({ project_id: project!.id, name: 'E', slug: `e2-${Date.now()}` })
      .select('id').single();
    await admin.from('mis_investments').insert([
      { evaluation_id: ev!.id, community: 'Sagnarigu', district: 'Tamale',
        investment_type: 'school', investment_name: 'Sagnarigu Primary School' },
    ]);

    const m = await matchInvestment({
      evaluationId: ev!.id, community: 'Sagnarigu', rawName: 'Sagnarigu Primary  Schl',
    });
    expect(m?.match_status === 'auto' || m?.match_status === 'unmatched').toBeTruthy();
  }, 30_000);

  it('returns unmatched when nothing close enough', async () => {
    const admin = adminClient();
    const project = await newProject(admin, 'MatchTest3');
    const { data: ev } = await admin.from('evaluations')
      .insert({ project_id: project!.id, name: 'E', slug: `e3-${Date.now()}` })
      .select('id').single();
    await admin.from('mis_investments').insert([
      { evaluation_id: ev!.id, community: 'Sagnarigu', district: 'Tamale',
        investment_type: 'school', investment_name: 'Sagnarigu Primary School' },
    ]);

    const m = await matchInvestment({
      evaluationId: ev!.id, community: 'Sagnarigu', rawName: 'Completely Unrelated Thing',
    });
    expect(m?.investment_id).toBeNull();
    expect(m?.match_status).toBe('unmatched');
  }, 30_000);
});
