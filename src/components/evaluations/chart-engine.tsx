import {
  aggregateDonut,
  aggregateBarPct,
  aggregateStackedBar,
  aggregateHorizontalBar,
  aggregateHeatmap,
  aggregateProgressBars,
  aggregateChoropleth,
  aggregateTrendLine,
} from '@/lib/evaluations/aggregate';
import type { ChartEntry } from '@/lib/evaluations/dashboard-spec';
import type { FilterState } from '@/lib/evaluations/schemas';

import { ChartCard } from './chart-card';
import { BarPctChart } from './charts/bar-pct';
import { ChoroplethChart } from './charts/choropleth';
import { DonutChart } from './charts/donut';
import { HeatmapChart } from './charts/heatmap';
import { HorizontalBarChart } from './charts/horizontal-bar';
import { ProgressBarsChart } from './charts/progress-bars';
import { StackedBarChart } from './charts/stacked-bar';
import { TrendLineChart } from './charts/trend-line';

/**
 * Resolves a spec entry to its chart data. The try/catch only wraps the async
 * aggregation — JSX is constructed outside it (rendering errors belong to an
 * error boundary, not a try/catch).
 */
async function resolveChart(props: {
  entry: ChartEntry;
  instrumentId: string;
  approvedOnly: boolean;
  filters: FilterState;
  targetN?: number;
  rows?: Record<string, unknown>[];
}): Promise<
  | { kind: 'ok'; node: React.ReactElement }
  | { kind: 'empty' }
  | { kind: 'invalid'; reason: string }
> {
  const { entry } = props;
  // Row-based charts share a single pre-fetched response set; treat a missing
  // `rows` prop as no data rather than crashing.
  const rows = props.rows ?? [];

  try {
    switch (entry.type) {
      case 'donut': {
        const d = aggregateDonut(rows, entry.field);
        return d.length
          ? { kind: 'ok', node: <DonutChart data={d} title={entry.title} /> }
          : { kind: 'empty' };
      }
      case 'bar_pct': {
        const d = aggregateBarPct(rows, entry.field);
        return d.length
          ? { kind: 'ok', node: <BarPctChart data={d} title={entry.title} /> }
          : { kind: 'empty' };
      }
      case 'stacked_bar': {
        if (!entry.by) return { kind: 'invalid', reason: 'missing "by"' };
        const d = aggregateStackedBar(rows, entry.field, entry.by);
        return d.length
          ? {
              kind: 'ok',
              node: <StackedBarChart data={d} title={entry.title} />,
            }
          : { kind: 'empty' };
      }
      case 'horizontal_bar': {
        const d = aggregateHorizontalBar(rows, entry.field);
        return d.length
          ? {
              kind: 'ok',
              node: <HorizontalBarChart data={d} title={entry.title} />,
            }
          : { kind: 'empty' };
      }
      case 'heatmap': {
        if (!entry.by) return { kind: 'invalid', reason: 'missing "by"' };
        const d = aggregateHeatmap(rows, entry.field, entry.by);
        return d.length
          ? { kind: 'ok', node: <HeatmapChart data={d} title={entry.title} /> }
          : { kind: 'empty' };
      }
      case 'choropleth': {
        const d = await aggregateChoropleth({
          instrumentId: props.instrumentId,
          targetN: props.targetN ?? 0,
        });
        return d.length
          ? {
              kind: 'ok',
              node: <ChoroplethChart data={d} title={entry.title} />,
            }
          : { kind: 'empty' };
      }
      case 'progress_bars': {
        const d = await aggregateProgressBars({
          instrumentId: props.instrumentId,
          targetN: props.targetN ?? 0,
        });
        return d.length
          ? {
              kind: 'ok',
              node: <ProgressBarsChart data={d} title={entry.title} />,
            }
          : { kind: 'empty' };
      }
      case 'trend_line': {
        const d = await aggregateTrendLine({
          instrumentId: props.instrumentId,
          days: 30,
        });
        return d.length
          ? {
              kind: 'ok',
              node: <TrendLineChart data={d} title={entry.title} />,
            }
          : { kind: 'empty' };
      }
      default:
        return { kind: 'invalid', reason: 'unknown chart type' };
    }
  } catch (e) {
    // Aggregation failures can carry raw DB error text (schema names, query
    // fragments). Log the real error server-side; show users a generic note.
    console.error('[chart-engine] aggregation failed', e);
    return {
      kind: 'invalid',
      reason: 'could not load chart data',
    };
  }
}

export async function ChartEngine(props: {
  entry: ChartEntry;
  instrumentId: string;
  approvedOnly: boolean;
  filters: FilterState;
  targetN?: number;
  rows?: Record<string, unknown>[];
}) {
  const result = await resolveChart(props);

  if (result.kind === 'ok') return result.node;
  if (result.kind === 'invalid') {
    return invalid(props.entry.title, result.reason);
  }
  return empty(props.entry.title);
}

function empty(title: string) {
  return (
    <ChartCard title={title}>
      <p className="text-sm text-muted-foreground">
        No data for this question yet.
      </p>
    </ChartCard>
  );
}

function invalid(title: string, reason: string) {
  return (
    <ChartCard title={title} tone="error">
      <p className="text-xs text-destructive">Chart misconfigured: {reason}</p>
    </ChartCard>
  );
}
