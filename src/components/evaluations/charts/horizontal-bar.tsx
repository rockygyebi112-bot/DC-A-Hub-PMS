'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { BucketCount } from '@/lib/evaluations/aggregate';
import { ChartCard } from '../chart-card';

export function HorizontalBarChart({ data, title }: { data: BucketCount[]; title: string }) {
  return (
    <ChartCard title={title}>
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
    </ChartCard>
  );
}
