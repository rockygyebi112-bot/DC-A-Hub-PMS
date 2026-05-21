'use client';
import { ChartCard } from '../chart-card';

export function ChoroplethChart(props: {
  data: { region: string; count: number; target: number; pct: number }[];
  title: string;
}) {
  return (
    <ChartCard title={props.title}>
      <ul className="space-y-2">
        {props.data.map((r) => (
          <li key={r.region}>
            <div className="flex justify-between text-xs">
              <span>{r.region}</span>
              <span>{r.count} / {r.target} ({Math.round(r.pct)}%)</span>
            </div>
            <div className="h-2 rounded bg-muted">
              <div className="h-2 rounded bg-primary"
                   style={{ width: `${Math.min(100, r.pct)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
