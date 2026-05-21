'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartCard } from '../chart-card';

export function TrendLineChart({ data, title }: {
  data: { day: string; count: number }[];
  title: string;
}) {
  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <XAxis dataKey="day" tick={{ fill: 'var(--muted-foreground)' }} />
          <YAxis tick={{ fill: 'var(--muted-foreground)' }} />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
          <Line type="monotone" dataKey="count" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
