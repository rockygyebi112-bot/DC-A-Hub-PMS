'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function TrendLineChart({ data, title }: {
  data: { day: string; count: number }[];
  title: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
