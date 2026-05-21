import 'server-only';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

export const getEvaluation = cache(async (id: string) => {
  const sb = await createClient();
  const { data, error } = await sb
    .from('evaluations')
    .select(
      `
      id, name, slug, status, project_id, description,
      collection_started_at, collection_target_n, dashboard_default_mode,
      instruments:evaluation_instruments(id, kind, name, kobo_form_id, schema_config, last_synced_at, last_sync_status),
      dashboard_configs:evaluation_dashboard_configs(id, version, spec, is_active)
    `,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export const listResponses = cache(
  async (args: {
    instrumentId: string;
    qcStatus?: 'pending' | 'approved' | 'cancelled_redo' | 'cancelled_dropped';
    region?: string;
    limit?: number;
  }) => {
    const sb = await createClient();
    let q = sb
      .from('evaluation_responses')
      .select(
        'id, kobo_submission_uuid, submitted_at, region, district, community, gender, age, qc_status, qc_checked_at, raw',
      )
      .eq('instrument_id', args.instrumentId);
    if (args.qcStatus) q = q.eq('qc_status', args.qcStatus);
    if (args.region) q = q.eq('region', args.region);
    const { data, error } = await q
      .order('submitted_at', { ascending: false })
      .limit(args.limit ?? 200);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const getActiveDashboardSpec = cache(async (evaluationId: string) => {
  const sb = await createClient();
  const { data, error } = await sb
    .from('evaluation_dashboard_configs')
    .select('id, version, spec')
    .eq('evaluation_id', evaluationId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export const getEvaluationForProject = cache(async (projectId: string) => {
  const sb = await createClient();
  const { data, error } = await sb
    .from('evaluations')
    .select('id, name, slug, status, collection_target_n, dashboard_default_mode')
    .eq('project_id', projectId)
    .in('status', ['collecting', 'analyzing'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export const getIngestionRunsSummary = cache(async (instrumentId: string) => {
  const sb = await createClient();
  const { data, error } = await sb
    .from('evaluation_ingestion_runs')
    .select(
      'id, trigger, started_at, finished_at, status, fetched_count, inserted_count, updated_count, unmatched_investment_count, error_message',
    )
    .eq('instrument_id', instrumentId)
    .order('started_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listOpenIssues = cache(async (instrumentId: string) => {
  const sb = await createClient();
  const { data, error } = await sb
    .from('evaluation_ingestion_issues')
    .select('id, kobo_submission_uuid, kind, details, created_at')
    .eq('instrument_id', instrumentId)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
});
