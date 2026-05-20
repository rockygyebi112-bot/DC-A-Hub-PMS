'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { StackedRow } from '@/lib/evaluations/aggregate';

const PALETTE = ['#0ea5e9','#22c55e','#f59e0b','#ef4444','#a855f7','#14b8a6'];

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
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows}>
          <XAxis dataKey="group" />
          <YAxis />
          <Tooltip />
          <Legend />
          {allSeries.map((lbl, i) => (
            <Bar key={lbl} dataKey={lbl} stackId="s" fill={PALETTE[i % PALETTE.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
