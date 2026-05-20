import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';
import { iterateKoboSubmissions, type KoboSubmission } from './kobo';
import { mapKoboSubmission } from './mapper';
import { matchInvestment } from './match-investments';

export type IngestResult = {
  run_id: string;
  status: 'ok' | 'partial' | 'error';
  fetched: number;
  inserted: number;
  updated: number;
  unmatched: number;
};

export async function ingestInstrument(opts: {
  instrumentId: string;
  trigger: 'schedule' | 'manual' | 'backfill';
}): Promise<IngestResult> {
  const sb = createServiceClient();

  // Look up the instrument + evaluation context.
  const { data: inst, error: instErr } = await sb
    .from('evaluation_instruments')
    .select('id, evaluation_id, kobo_form_id, schema_config, last_synced_at')
    .eq('id', opts.instrumentId)
    .single();
  if (instErr || !inst) throw new Error(`Instrument lookup failed: ${instErr?.message}`);

  // Start a run row.
  const { data: run, error: runErr } = await sb
    .from('evaluation_ingestion_runs')
    .insert({ instrument_id: inst.id, trigger: opts.trigger, status: 'running' })
    .select('id').single();
  if (runErr || !run) throw new Error(`Run insert failed: ${runErr?.message}`);

  let fetched = 0, inserted = 0, updated = 0, unmatched = 0;
  // `details` typed as `Json` (not `Record<string, unknown>`) so the array
  // matches the `evaluation_ingestion_issues.details` jsonb Insert type.
  const issues: Array<{ kobo_submission_uuid: string; kind: string; details: Json }> = [];
  let errorMessage: string | null = null;

  try {
    const since = opts.trigger === 'backfill' ? null : inst.last_synced_at ?? null;

    for await (const sub of iterateKoboSubmissions({
      instrumentId: inst.id,
      koboFormId: inst.kobo_form_id,
      since,
    })) {
      fetched++;
      const row = mapKoboSubmission(sub, (inst.schema_config ?? {}) as Record<string, string>, inst.id);

      // `row.raw` is typed `Record<string, unknown>` (a Task 9 deviation);
      // the `raw` jsonb column's generated Insert type wants `Json`. The data
      // is genuinely JSON-serialisable Kobo output — cast just the jsonb field.
      const { data: upserted, error: upErr } = await sb
        .from('evaluation_responses')
        .upsert(
          { ...row, raw: row.raw as Json },
          { onConflict: 'instrument_id,kobo_submission_uuid' },
        )
        .select('id, ingested_at')
        .single();
      if (upErr || !upserted) {
        issues.push({
          kobo_submission_uuid: row.kobo_submission_uuid,
          kind: 'upsert_failed',
          details: { error: upErr?.message },
        });
        continue;
      }
      // Approximate insert vs update by comparing ingested_at to "now".
      const isInsert = Date.now() - new Date(upserted.ingested_at).getTime() < 5000;
      if (isInsert) inserted++; else updated++;

      // HH investment repeat block: each entry under "investments" (Kobo
      // repeat block name) is processed against mis_investments.
      const repeats = extractRepeats(sub, 'investments');
      for (const r of repeats) {
        const rawName = String(r['inv_name'] ?? r['investment_name'] ?? '').trim();
        if (!rawName) continue;
        const match = await matchInvestment({
          evaluationId: inst.evaluation_id,
          community: String(row.community ?? ''),
          rawName,
        });
        await sb.from('evaluation_response_investments').insert({
          response_id: upserted.id,
          investment_id: match.investment_id,
          raw_investment_name: rawName,
          // `r` is a Kobo repeat-block record (Record<string, unknown>);
          // `answers` is a jsonb column — cast to Json for the Insert type.
          answers: r as Json,
          match_status: match.match_status,
        });
        if (match.match_status === 'unmatched') {
          unmatched++;
          issues.push({
            kobo_submission_uuid: row.kobo_submission_uuid,
            kind: 'unmatched_investment',
            details: { raw_investment_name: rawName, community: row.community },
          });
        }
      }
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  // Persist issues.
  if (issues.length > 0) {
    await sb.from('evaluation_ingestion_issues').insert(
      issues.map((i) => ({ ...i, run_id: run.id, instrument_id: inst.id })),
    );
  }

  const status: IngestResult['status'] =
    errorMessage ? (fetched > 0 ? 'partial' : 'error') : 'ok';

  await sb.from('evaluation_ingestion_runs').update({
    finished_at: new Date().toISOString(),
    status,
    fetched_count: fetched,
    inserted_count: inserted,
    updated_count: updated,
    unmatched_investment_count: unmatched,
    error_message: errorMessage,
  }).eq('id', run.id);

  // Update last_synced_at + last_sync_* on the instrument.
  await sb.from('evaluation_instruments').update({
    last_synced_at: new Date().toISOString(),
    last_sync_status: status,
    last_sync_error: errorMessage,
    updated_at: new Date().toISOString(),
  }).eq('id', inst.id);

  return { run_id: run.id, status, fetched, inserted, updated, unmatched };
}

// Assumes the Kobo HH repeat block is keyed exactly `investments` at the top
// level of the submission. Real forms may nest it under a group prefix (e.g.
// `group_x/investments`); that mapping is deferred to the admin schema_config.
function extractRepeats(sub: KoboSubmission, blockName: string): Record<string, unknown>[] {
  const v = (sub as Record<string, unknown>)[blockName];
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  return [];
}
