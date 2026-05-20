'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { BucketCount } from '@/lib/evaluations/aggregate';

export function HorizontalBarChart({ data, title }: { data: BucketCount[]; title: string }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <XAxis type="number" />
          <YAxis type="category" dataKey="label" width={150} />
          <Tooltip />
          <Bar dataKey="count" fill="#22c55e" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
