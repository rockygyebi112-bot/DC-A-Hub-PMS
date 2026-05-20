import { fetchResponseRows } from '@/lib/evaluations/aggregate';
import { getActiveDashboardSpec } from '@/lib/evaluations/queries';
import { DashboardSpec } from '@/lib/evaluations/dashboard-spec';
import type { FilterState } from '@/lib/evaluations/schemas';
import { createClient } from '@/lib/supabase/server';

import { ChartEngine } from './chart-engine';
import { FilterBar } from './filter-bar';
import { KpiTile } from './kpi-tile';
import { ModeToggle } from './mode-toggle';
import { SyncNowButton } from './sync-now-button';

export async function DashboardView(props: {
  evaluationId: string;
  instrumentId: string;
  targetN: number | null;
  defaultMode: 'auto' | 'progress' | 'findings';
  searchParams: Record<string, string | string[] | undefined>;
  approvedOnly: boolean;
  showStaffControls: boolean;
}) {
  const cfg = await getActiveDashboardSpec(props.evaluationId);
  if (!cfg) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        No dashboard config is active for this evaluation.
      </p>
    );
  }
  const spec = DashboardSpec.parse(cfg.spec);

  const filters: FilterState = {
    region: pickStr(props.searchParams.region),
    district: pickStr(props.searchParams.district),
    community: pickStr(props.searchParams.community),
    gender: (pickStr(props.searchParams.gender) as FilterState['gender']) ?? 'all',
    soco_exposure: pickStr(props.searchParams.soco_exposure) ?? 'All',
  };

  // Decide default mode if not overridden.
  const sb = await createClient();
  const { count: approvedCount } = await sb
    .from('evaluation_responses')
    .select('id', { count: 'exact', head: true })
    .eq('instrument_id', props.instrumentId)
    .eq('qc_status', 'approved');
  const targetN = props.targetN ?? 0;
  const collectionPct = targetN > 0 ? (approvedCount ?? 0) / targetN : 0;
  const autoMode: 'progress' | 'findings' =
    collectionPct >= 0.8 ? 'findings' : 'progress';
  const explicit = pickStr(props.searchParams.mode) as
    | 'progress'
    | 'findings'
    | undefined;
  const effectiveDefault: 'progress' | 'findings' =
    props.defaultMode === 'auto'
      ? autoMode
      : (props.defaultMode as 'progress' | 'findings');
  const mode = explicit ?? effectiveDefault;

  // Filter option sources — just distinct values from responses (cheap at v1 scale).
  const distinct = async (col: 'region' | 'district' | 'community') => {
    const { data } = await sb
      .from('evaluation_responses')
      .select(col)
      .eq('instrument_id', props.instrumentId)
      .not(col, 'is', null);
    return Array.from(
      new Set((data ?? []).map((r: Record<string, unknown>) => r[col] as string)),
    ).sort();
  };
  const [regions, districts, communities] = await Promise.all([
    distinct('region'),
    distinct('district'),
    distinct('community'),
  ]);
  const exposureOptions = [
    'All',
    ...Object.keys(spec.disaggregations.soco_exposure),
  ];

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Evaluation dashboard</h1>
          <span className="text-xs text-muted-foreground">
            {approvedCount ?? 0} approved / {targetN || '—'} target
          </span>
        </div>
        <div className="flex items-center gap-2">
          {props.showStaffControls && (
            <SyncNowButton instrumentId={props.instrumentId} />
          )}
          <ModeToggle defaultMode={effectiveDefault} />
        </div>
      </header>

      <FilterBar
        regions={regions}
        districts={districts}
        communities={communities}
        socoExposureOptions={exposureOptions}
      />

      {mode === 'progress' ? (
        <ProgressMode
          targetN={targetN}
          instrumentId={props.instrumentId}
          approvedOnly={props.approvedOnly}
          filters={filters}
        />
      ) : (
        <FindingsMode
          spec={spec}
          instrumentId={props.instrumentId}
          approvedOnly={props.approvedOnly}
          filters={filters}
          targetN={targetN}
        />
      )}
    </div>
  );
}

function pickStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

async function ProgressMode(props: {
  instrumentId: string;
  approvedOnly: boolean;
  targetN: number;
  filters: FilterState;
}) {
  // KPI values are stubbed ("—") pending a dedicated KPI-computation pass;
  // wiring up real numbers is intentionally out of scope for this task.
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiTile label="Approved" value="—" sub="vs target" />
        <KpiTile label="Awaiting QC" value="—" />
        <KpiTile label="Districts active" value="—" />
      </div>
      <ChartEngine
        entry={{
          type: 'choropleth',
          field: '_progress',
          title: 'Regional % of target',
        }}
        instrumentId={props.instrumentId}
        approvedOnly={props.approvedOnly}
        filters={props.filters}
        targetN={props.targetN}
      />
      <ChartEngine
        entry={{
          type: 'trend_line',
          field: '_submitted_at',
          title: 'Daily submissions (last 30 days)',
        }}
        instrumentId={props.instrumentId}
        approvedOnly={props.approvedOnly}
        filters={props.filters}
      />
      <ChartEngine
        entry={{
          type: 'progress_bars',
          field: '_progress',
          title: 'Per-region progress vs target',
        }}
        instrumentId={props.instrumentId}
        approvedOnly={props.approvedOnly}
        filters={props.filters}
        targetN={props.targetN}
      />
    </section>
  );
}

async function FindingsMode(props: {
  spec: DashboardSpec;
  instrumentId: string;
  approvedOnly: boolean;
  filters: FilterState;
  targetN: number;
}) {
  // Fetch the response set ONCE and share it across every row-based chart,
  // instead of each ChartEngine re-querying the full table independently.
  const rows = await fetchResponseRows({
    instrumentId: props.instrumentId,
    approvedOnly: props.approvedOnly,
    filters: props.filters,
  });
  return (
    <section className="space-y-8">
      {props.spec.sections.map((s) => (
        <div key={s.id} className="space-y-3">
          <h2 className="text-lg font-medium">{s.title}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {s.charts.map((c, i) => (
              <ChartEngine
                key={`${s.id}-${i}`}
                entry={c}
                instrumentId={props.instrumentId}
                approvedOnly={props.approvedOnly}
                filters={props.filters}
                targetN={props.targetN}
                rows={rows}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
