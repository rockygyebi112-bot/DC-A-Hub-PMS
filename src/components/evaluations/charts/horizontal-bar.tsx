'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { BucketCount } from '@/lib/evaluations/aggregate';

export function HorizontalBarChart({ data, title }: { data: BucketCount[]; title: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" tick={{ fill: 'var(--muted-foreground)' }} />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={{ fill: 'var(--muted-foreground)' }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
          <Bar dataKey="count" fill="var(--chart-2)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
