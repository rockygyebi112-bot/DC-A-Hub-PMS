'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { BucketCount } from '@/lib/evaluations/aggregate';

const PALETTE = ['#0ea5e9','#22c55e','#f59e0b','#ef4444','#a855f7','#14b8a6','#eab308','#64748b'];

export function DonutChart({ data, title }: { data: BucketCount[]; title: string }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="label" innerRadius={50} outerRadius={80}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
