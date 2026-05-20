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
}): Promise<
  | { kind: 'ok'; node: React.ReactElement }
  | { kind: 'empty' }
  | { kind: 'invalid'; reason: string }
> {
  const base = {
    instrumentId: props.instrumentId,
    approvedOnly: props.approvedOnly,
    filters: props.filters,
  };
  const { entry } = props;

  try {
    switch (entry.type) {
      case 'donut': {
        const d = await aggregateDonut({ ...base, field: entry.field });
        return d.length
          ? { kind: 'ok', node: <DonutChart data={d} title={entry.title} /> }
          : { kind: 'empty' };
      }
      case 'bar_pct': {
        const d = await aggregateBarPct({ ...base, field: entry.field });
        return d.length
          ? { kind: 'ok', node: <BarPctChart data={d} title={entry.title} /> }
          : { kind: 'empty' };
      }
      case 'stacked_bar': {
        if (!entry.by) return { kind: 'invalid', reason: 'missing "by"' };
        const d = await aggregateStackedBar({
          ...base,
          field: entry.field,
          by: entry.by,
        });
        return d.length
          ? {
              kind: 'ok',
              node: <StackedBarChart data={d} title={entry.title} />,
            }
          : { kind: 'empty' };
      }
      case 'horizontal_bar': {
        const d = await aggregateHorizontalBar({ ...base, field: entry.field });
        return d.length
          ? {
              kind: 'ok',
              node: <HorizontalBarChart data={d} title={entry.title} />,
            }
          : { kind: 'empty' };
      }
      case 'heatmap': {
        if (!entry.by) return { kind: 'invalid', reason: 'missing "by"' };
        const d = await aggregateHeatmap({
          ...base,
          field: entry.field,
          by: entry.by,
        });
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
    return {
      kind: 'invalid',
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function ChartEngine(props: {
  entry: ChartEntry;
  instrumentId: string;
  approvedOnly: boolean;
  filters: FilterState;
  targetN?: number;
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
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <p className="text-xs text-slate-500">No data for this cut.</p>
    </div>
  );
}

function invalid(title: string, reason: string) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h3 className="mb-1 text-sm font-medium">{title}</h3>
      <p className="text-xs text-amber-700">Chart misconfigured: {reason}</p>
    </div>
  );
}
