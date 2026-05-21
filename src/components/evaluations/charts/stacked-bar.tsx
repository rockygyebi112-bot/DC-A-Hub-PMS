'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { StackedRow } from '@/lib/evaluations/aggregate';
import { ChartCard } from '../chart-card';

const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function StackedBarChart({ data, title }: { data: StackedRow[]; title: string }) {
  const allSeries = Array.from(new Set(data.flatMap((r) => r.series.map((s) => s.label))));
  const rows = data.map((r) => {
    const out: Record<string, number | string> = { group: r.group };
    for (const lbl of allSeries) {
      out[lbl] = r.series.find((s) => s.label === lbl)?.count ?? 0;
    }
    return out;
  });
  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows}>
          <XAxis dataKey="group" tick={{ fill: 'var(--muted-foreground)' }} />
          <YAxis tick={{ fill: 'var(--muted-foreground)' }} />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
          <Legend />
          {allSeries.map((lbl, i) => (
            <Bar key={lbl} dataKey={lbl} stackId="s" fill={PALETTE[i % PALETTE.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
