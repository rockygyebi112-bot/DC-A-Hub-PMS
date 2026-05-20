'use client';
import type { StackedRow } from '@/lib/evaluations/aggregate';

export function HeatmapChart({ data, title }: { data: StackedRow[]; title: string }) {
  const seriesLabels = Array.from(new Set(data.flatMap((r) => r.series.map((s) => s.label))));
  const max = Math.max(1, ...data.flatMap((r) => r.series.map((s) => s.count)));

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th></th>
              {seriesLabels.map((l) => <th key={l} className="px-2 py-1">{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.group}>
                <th className="px-2 py-1 text-left">{row.group}</th>
                {seriesLabels.map((l) => {
                  const c = row.series.find((s) => s.label === l)?.count ?? 0;
                  const alpha = c / max;
                  return (
                    <td key={l} className="px-3 py-2 text-center"
                        style={{ background: `rgba(14, 165, 233, ${alpha})` }}>
                      {c}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
