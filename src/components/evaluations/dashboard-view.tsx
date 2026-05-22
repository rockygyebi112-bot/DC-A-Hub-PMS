import { Suspense } from 'react';
import Link from 'next/link';

import { fetchResponseRows } from '@/lib/evaluations/aggregate';
import { getActiveDashboardSpec } from '@/lib/evaluations/queries';
import { DashboardSpec } from '@/lib/evaluations/dashboard-spec';
import type { FilterState } from '@/lib/evaluations/schemas';
import { createClient } from '@/lib/supabase/server';

import { ProjectMetricCard } from '@/app/workspace/projects/[id]/_components/project-metric-card';
import { ProjectProgress } from '@/components/workspace/project-progress';

import { ChartEngine } from './chart-engine';
import { FilterBar } from './filter-bar';
import { ModeToggle } from './mode-toggle';
import { SyncNowButton } from './sync-now-button';

export async function DashboardView(props: {
  projectId: string;
  evaluationId: string;
  instrumentId: string;
  targetN: number | null;
  defaultMode: 'auto' | 'progress' | 'findings';
  searchParams: Record<string, string | string[] | undefined>;
  approvedOnly: boolean;
  showStaffControls: boolean;
}) {
  const sb = await createClient();
  const cfg = await getActiveDashboardSpec(props.evaluationId);
  if (!cfg) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <h2 className="font-heading text-sm font-semibold tracking-tight text-foreground">
            Dashboard not configured yet
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Define the dashboard spec to see each survey question rendered as a
            chart here. Until a spec is saved there are no questions to
            display.
          </p>
        </div>
      </div>
    );
  }
  const spec = DashboardSpec.parse(cfg.spec);

  const [approvedRes, filterRowsRes] = await Promise.all([
    sb
      .from('evaluation_responses')
      .select('id', { count: 'exact', head: true })
      .eq('instrument_id', props.instrumentId)
      .eq('qc_status', 'approved'),
    sb
      .from('evaluation_responses')
      .select('region, district, community')
      .eq('instrument_id', props.instrumentId),
  ]);
  const approvedCount = approvedRes.count;
  const filterRows = filterRowsRes.data;

  const filters: FilterState = {
    region: pickStr(props.searchParams.region),
    district: pickStr(props.searchParams.district),
    community: pickStr(props.searchParams.community),
    gender: (pickStr(props.searchParams.gender) as FilterState['gender']) ?? 'all',
    soco_exposure: pickStr(props.searchParams.soco_exposure) ?? 'All',
  };

  // Decide default mode if not overridden.
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

  // Filter option sources — distinct region/district/community values. One
  // query pulls all three columns; the distinct sets are derived in memory
  // (cheap at v1 scale) instead of three separate round trips.
  const distinctValues = (col: 'region' | 'district' | 'community') =>
    Array.from(
      new Set(
        (filterRows ?? [])
          .map((r: Record<string, unknown>) => r[col])
          .filter((v): v is string => Boolean(v)),
      ),
    ).sort();
  const regions = distinctValues('region');
  const districts = distinctValues('district');
  const communities = distinctValues('community');
  const exposureOptions = [
    'All',
    ...Object.keys(spec.disaggregations.soco_exposure),
  ];

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {approvedCount ?? 0} approved / {targetN || '—'} target
        </span>
        <div className="flex items-center gap-2">
          {props.showStaffControls && (
            <>
              <SyncNowButton instrumentId={props.instrumentId} />
              <Link
                href={`/workspace/projects/${props.projectId}/responses`}
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-accent"
              >
                Review responses
              </Link>
            </>
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

      {/* key={mode} re-suspends the boundary on every toggle, so the
          skeleton shows immediately while the new mode's chart queries run
          — the header, filters and toggle above stay interactive. */}
      <Suspense key={mode} fallback={<DashboardModeSkeleton />}>
        {mode === 'progress' ? (
          <ProgressMode
            targetN={targetN}
            instrumentId={props.instrumentId}
            approvedOnly={props.approvedOnly}
            filters={filters}
            approvedCount={approvedCount ?? 0}
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
      </Suspense>
    </div>
  );
}

function DashboardModeSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border bg-muted/40"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[288px] animate-pulse rounded-xl border bg-muted/40"
          />
        ))}
      </div>
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
  approvedCount: number;
}) {
  // Two independent count/select reads for the remaining KPI tiles.
  const sb = await createClient();
  const [pendingRes, districtRes] = await Promise.all([
    sb
      .from('evaluation_responses')
      .select('id', { count: 'exact', head: true })
      .eq('instrument_id', props.instrumentId)
      .eq('qc_status', 'pending'),
    sb
      .from('evaluation_responses')
      .select('district')
      .eq('instrument_id', props.instrumentId),
  ]);
  const pendingCount = pendingRes.count ?? 0;
  const districtsActive = new Set(
    (districtRes.data ?? [])
      .map((r: { district: string | null }) => r.district)
      .filter((d): d is string => Boolean(d)),
  ).size;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <ProjectMetricCard title="Approved">
          <ProjectProgress done={props.approvedCount} total={props.targetN} />
        </ProjectMetricCard>
        <ProjectMetricCard title="Awaiting QC">
          <p className="font-heading text-2xl font-semibold tabular-nums">
            {pendingCount}
          </p>
        </ProjectMetricCard>
        <ProjectMetricCard title="Districts active">
          <p className="font-heading text-2xl font-semibold tabular-nums">
            {districtsActive}
          </p>
        </ProjectMetricCard>
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
