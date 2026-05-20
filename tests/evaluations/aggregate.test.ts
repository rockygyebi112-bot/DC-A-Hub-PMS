import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient, cleanupTestData } from '../rls/setup';
import {
  aggregateDonut, aggregateBarPct, aggregateStackedBar,
} from '@/lib/evaluations/aggregate';

let instrumentId: string;
const admin = adminClient();

beforeAll(async () => {
  // projects.client_id is NOT NULL; create a client first. Name matches the
  // `PM-Test %` pattern that cleanupTestData() sweeps.
  const { data: client } = await admin
    .from('clients').insert({ name: `PM-Test AggTest ${Date.now()}` })
    .select('id').single();
  const { data: project } = await admin.from('projects')
    .insert({ name: 'AggTest', code: `AGG-${Date.now()}`, client_id: client!.id })
    .select('id').single();
  const { data: ev } = await admin.from('evaluations')
    .insert({ project_id: project!.id, name: 'E', slug: `agg-${Date.now()}` })
    .select('id').single();
  const { data: inst } = await admin.from('evaluation_instruments')
    .insert({ evaluation_id: ev!.id, kind: 'hh', name: 'HH', kobo_form_id: 'f' })
    .select('id').single();
  instrumentId = inst!.id;

  await admin.from('evaluation_responses').insert([
    { instrument_id: inst!.id, kobo_submission_uuid: 'a', submitted_at: '2026-05-01T00:00:00Z',
      raw: { s3_a1: 1 }, gender: 'female', region: 'Northern', qc_status: 'approved' },
    { instrument_id: inst!.id, kobo_submission_uuid: 'b', submitted_at: '2026-05-02T00:00:00Z',
      raw: { s3_a1: 0 }, gender: 'male', region: 'Northern', qc_status: 'approved' },
    { instrument_id: inst!.id, kobo_submission_uuid: 'c', submitted_at: '2026-05-03T00:00:00Z',
      raw: { s3_a1: 1 }, gender: 'female', region: 'Upper East', qc_status: 'approved' },
    { instrument_id: inst!.id, kobo_submission_uuid: 'd', submitted_at: '2026-05-04T00:00:00Z',
      raw: { s3_a1: 1 }, gender: 'male', region: 'Northern', qc_status: 'pending' },
  ]);
}, 30_000);

afterAll(async () => { await cleanupTestData(); });

describe('aggregators', () => {
  it('donut counts approved-only by default', async () => {
    const buckets = await aggregateDonut({
      instrumentId, field: 's3_a1', approvedOnly: true, client: admin,
    });
    const m = new Map(buckets.map((b) => [String(b.label), b.count]));
    expect(m.get('1')).toBe(2);
    expect(m.get('0')).toBe(1);
  });

  it('bar_pct returns shares', async () => {
    const buckets = await aggregateBarPct({
      instrumentId, field: 's3_a1', approvedOnly: true, client: admin,
    });
    const total = buckets.reduce((s, b) => s + b.pct, 0);
    expect(Math.round(total)).toBe(100);
  });

  it('stacked_bar splits by gender', async () => {
    const rows = await aggregateStackedBar({
      instrumentId, field: 's3_a1', by: 'gender', approvedOnly: true, client: admin,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty('group');
    expect(rows[0]).toHaveProperty('series');
  });
});
