import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { adminClient, cleanupTestData } from '../rls/setup';
import { ingestInstrument } from '@/lib/evaluations/ingest';
import { encryptToken } from '@/lib/evaluations/kobo-crypto';
import sample from '../fixtures/kobo-sample.json';

/**
 * End-to-end ingestion test (Tasks 8-11 gate). Runs `ingestInstrument`
 * against a mocked Kobo HTTP endpoint and a real hosted Supabase.
 */

const admin = adminClient();
let instrumentId: string;
let evaluationId: string;

beforeAll(async () => {
  // projects.client_id is NOT NULL; create a client first. Name matches the
  // `PM-Test %` pattern that cleanupTestData() sweeps.
  const { data: client, error: clientErr } = await admin
    .from('clients')
    .insert({ name: `PM-Test IngestTest ${Date.now()}` })
    .select('id')
    .single();
  if (clientErr) throw clientErr;

  const { data: project, error: projErr } = await admin
    .from('projects')
    .insert({ name: 'IngestTest', code: `ING-${Date.now()}`, client_id: client!.id })
    .select('id')
    .single();
  if (projErr) throw projErr;

  const { data: ev, error: evErr } = await admin
    .from('evaluations')
    .insert({
      project_id: project!.id,
      name: 'Ingest E',
      slug: `ingest-${Date.now()}`,
      status: 'collecting',
    })
    .select('id')
    .single();
  if (evErr) throw evErr;
  evaluationId = ev!.id;

  const { data: inst, error: instErr } = await admin
    .from('evaluation_instruments')
    .insert({
      evaluation_id: ev!.id,
      kind: 'hh',
      name: 'HH',
      kobo_form_id: 'test-form',
      schema_config: {
        s0_a4: 'region',
        s0_a5: 'district',
        s0_a7: 'community',
        s1_a1: 'gender',
        s1_a2: 'age',
        s7_qc_status: 'qc_status',
      },
    })
    .select('id')
    .single();
  if (instErr) throw instErr;
  instrumentId = inst!.id;

  // Provision the Kobo token: encrypt in JS and write the `\x`-hex into the
  // bytea column directly (the format decryptKoboToken / byteaToBuffer expect).
  // There is NO kobo_token_set RPC — pgsodium was abandoned in Task 5.
  const ciphertext = encryptToken('test-token');
  const { error: tokErr } = await admin
    .from('evaluation_instruments')
    .update({ kobo_api_token_encrypted: '\\x' + ciphertext.toString('hex') })
    .eq('id', instrumentId);
  if (tokErr) throw tokErr;

  // MIS seed: one investment that submission 1001 matches; 1002's
  // "Completely Unknown Investment" will NOT match -> unmatched issue.
  const { error: misErr } = await admin.from('mis_investments').insert({
    evaluation_id: ev!.id,
    community: 'Sagnarigu',
    district: 'Tamale',
    investment_type: 'water',
    investment_name: 'Sagnarigu Borehole 1',
  });
  if (misErr) throw misErr;
}, 60_000);

afterAll(async () => {
  vi.unstubAllGlobals();
  await cleanupTestData();
});

describe('ingestInstrument (mocked Kobo)', () => {
  it('upserts responses, dedups, maps QC, logs unmatched investment', async () => {
    // Mock only Kobo /data calls; let Supabase HTTP calls hit the real `fetch`.
    // The fixture has 3 results (< 200 pageSize) so `iterateKoboSubmissions`
    // does exactly one page then stops.
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        if (url.includes('/data')) {
          return {
            ok: true,
            status: 200,
            json: async () => sample,
            text: async () => JSON.stringify(sample),
          } as unknown as Response;
        }
        return realFetch(input, init);
      }),
    );

    const result = await ingestInstrument({ instrumentId, trigger: 'manual' });

    expect(['ok', 'partial']).toContain(result.status);
    expect(result.fetched).toBeGreaterThanOrEqual(2);

    // Responses store
    const { data: responses } = await admin
      .from('evaluation_responses')
      .select('kobo_submission_uuid, qc_status, region')
      .eq('instrument_id', instrumentId);
    const byUuid = new Map(
      (responses ?? []).map((r) => [r.kobo_submission_uuid, r]),
    );
    expect(byUuid.has('sub-1001')).toBe(true);
    expect(byUuid.has('sub-1002')).toBe(true);

    // sub-1001 appears in the fixture twice -> upsert dedups on the unique key
    const dup1001 = (responses ?? []).filter(
      (r) => r.kobo_submission_uuid === 'sub-1001',
    );
    expect(dup1001).toHaveLength(1);

    // QC + geo mapping
    expect(byUuid.get('sub-1001')!.qc_status).toBe('approved');
    expect(byUuid.get('sub-1001')!.region).toBe('Northern');

    // Unmatched investment logged as an ingestion issue
    const { data: issues } = await admin
      .from('evaluation_ingestion_issues')
      .select('kind')
      .eq('instrument_id', instrumentId);
    expect((issues ?? []).some((i) => i.kind === 'unmatched_investment')).toBe(
      true,
    );

    // Ingestion run row written with sane counts
    const { data: runs } = await admin
      .from('evaluation_ingestion_runs')
      .select('status, fetched_count, unmatched_investment_count')
      .eq('instrument_id', instrumentId);
    expect((runs ?? []).length).toBeGreaterThanOrEqual(1);
    const run = (runs ?? [])[0]!;
    expect(run.fetched_count).toBeGreaterThanOrEqual(2);
    expect(run.unmatched_investment_count).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
