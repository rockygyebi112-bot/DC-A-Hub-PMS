'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { BucketPct } from '@/lib/evaluations/aggregate';

export function BarPctChart({ data, title }: { data: BucketPct[]; title: string }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <XAxis dataKey="label" />
          <YAxis tickFormatter={(v) => `${Math.round(v as number)}%`} />
          <Tooltip formatter={(v) => `${Math.round(v as number)}%`} />
          <Bar dataKey="pct" fill="#0ea5e9" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
