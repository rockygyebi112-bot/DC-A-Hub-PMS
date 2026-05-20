import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';
import type { FilterState } from './schemas';

type Client = SupabaseClient<Database>;

/**
 * Aggregators run against the DB live (no materialized views in v1 — ~2k rows,
 * trivially fast). They default to the auth-respecting SSR `createClient()` so
 * RLS filters client-vs-staff visibility automatically. An optional `client`
 * may be injected (e.g. by integration tests, which have no request context).
 */
type BaseArgs = {
  instrumentId: string;
  approvedOnly?: boolean;
  filters?: FilterState;
  client?: Client;
};

type DonutArgs = BaseArgs & { field: string };
type BarArgs = DonutArgs;
type StackedArgs = BaseArgs & { field: string; by: string };

export type BucketCount = { label: string; count: number };
export type BucketPct = { label: string; pct: number; count: number };
export type StackedRow = { group: string; series: { label: string; count: number }[] };

const DEMO_COLS = new Set(['region', 'district', 'community', 'gender', 'age']);

async function resolveClient(injected?: Client): Promise<Client> {
  return injected ?? ((await createClient()) as unknown as Client);
}

async function fetchRows(args: BaseArgs): Promise<Record<string, unknown>[]> {
  const sb = await resolveClient(args.client);
  let q = sb
    .from('evaluation_responses')
    .select('raw, region, district, community, gender, age, qc_status')
    .eq('instrument_id', args.instrumentId);
  if (args.approvedOnly) q = q.eq('qc_status', 'approved');
  const f = args.filters;
  if (f?.region) q = q.eq('region', f.region);
  if (f?.district) q = q.eq('district', f.district);
  if (f?.community) q = q.eq('community', f.community);
  if (f && f.gender !== 'all') q = q.eq('gender', f.gender);
  const { data, error } = await q;
  if (error) throw new Error(`aggregate query: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

function readField(row: Record<string, unknown>, field: string): unknown {
  if (DEMO_COLS.has(field)) return row[field];
  const raw = row.raw as Record<string, unknown> | undefined;
  return raw?.[field];
}

export async function aggregateDonut(args: DonutArgs): Promise<BucketCount[]> {
  const rows = await fetchRows(args);
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = readField(r, args.field);
    if (v === null || v === undefined) continue;
    const key = String(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
}

export async function aggregateBarPct(args: BarArgs): Promise<BucketPct[]> {
  const buckets = await aggregateDonut(args);
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0) return [];
  return buckets.map((b) => ({ ...b, pct: (b.count / total) * 100 }));
}

export async function aggregateStackedBar(args: StackedArgs): Promise<StackedRow[]> {
  const rows = await fetchRows(args);
  const groups = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const grp = readField(r, args.by);
    const val = readField(r, args.field);
    if (grp === null || grp === undefined) continue;
    if (val === null || val === undefined) continue;
    const gKey = String(grp);
    const vKey = String(val);
    if (!groups.has(gKey)) groups.set(gKey, new Map());
    const inner = groups.get(gKey)!;
    inner.set(vKey, (inner.get(vKey) ?? 0) + 1);
  }
  return Array.from(groups.entries()).map(([group, m]) => ({
    group,
    series: Array.from(m.entries()).map(([label, count]) => ({ label, count })),
  }));
}

export async function aggregateHorizontalBar(args: BarArgs): Promise<BucketCount[]> {
  return aggregateDonut(args);
}

export async function aggregateHeatmap(args: StackedArgs): Promise<StackedRow[]> {
  return aggregateStackedBar(args);
}

export async function aggregateProgressBars(args: {
  instrumentId: string;
  targetN: number;
  client?: Client;
}) {
  const sb = await resolveClient(args.client);
  const { data, error } = await sb
    .from('evaluation_responses')
    .select('region')
    .eq('instrument_id', args.instrumentId)
    .eq('qc_status', 'approved');
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { region: string | null }[]) {
    if (!r.region) continue;
    counts.set(r.region, (counts.get(r.region) ?? 0) + 1);
  }
  const perRegionTarget = Math.max(1, Math.floor(args.targetN / Math.max(1, counts.size)));
  return Array.from(counts.entries()).map(([region, count]) => ({
    region, count, target: perRegionTarget, pct: (count / perRegionTarget) * 100,
  }));
}

export async function aggregateTrendLine(args: {
  instrumentId: string;
  days: number;
  client?: Client;
}) {
  const sb = await resolveClient(args.client);
  const cutoff = new Date(Date.now() - args.days * 86400000).toISOString();
  const { data, error } = await sb
    .from('evaluation_responses')
    .select('submitted_at')
    .eq('instrument_id', args.instrumentId)
    .gte('submitted_at', cutoff);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { submitted_at: string }[]) {
    const day = r.submitted_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
}

export async function aggregateChoropleth(args: {
  instrumentId: string;
  targetN: number;
  client?: Client;
}) {
  return aggregateProgressBars(args);
}
