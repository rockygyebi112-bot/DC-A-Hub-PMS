'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { BucketPct } from '@/lib/evaluations/aggregate';

export function BarPctChart({ data, title }: { data: BucketPct[]; title: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)' }} />
          <YAxis
            tickFormatter={(v) => `${Math.round(v as number)}%`}
            tick={{ fill: 'var(--muted-foreground)' }}
          />
          <Tooltip
            formatter={(v) => `${Math.round(v as number)}%`}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
          <Bar dataKey="pct" fill="var(--chart-1)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
