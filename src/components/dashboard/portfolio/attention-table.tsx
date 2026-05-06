"use client";

import Link from "next/link";
import { StatusPill } from "@/components/projects/status-pill";
import type { AttentionRow } from "@/lib/portfolio/types";

interface Props {
  rows: AttentionRow[];
}

export function AttentionTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        All projects are currently on track.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-semibold">Project</th>
            <th className="text-left px-3 py-2 font-semibold">Status</th>
            <th className="text-right px-3 py-2 font-semibold">% Complete</th>
            <th className="text-right px-3 py-2 font-semibold">Overdue</th>
            <th className="text-right px-3 py-2 font-semibold">Blocked</th>
            <th className="text-left px-4 py-2 font-semibold">Lead</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.project_id} className="hover:bg-accent/40">
              <td className="px-4 py-2">
                <Link
                  href={`/projects/${r.project_slug}`}
                  className="font-medium hover:underline"
                >
                  {r.project_name}
                </Link>
              </td>
              <td className="px-3 py-2">
                <StatusPill status={r.computed_status} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.percent_complete}%
              </td>
              <td
                className={`px-3 py-2 text-right tabular-nums ${
                  r.overdue_count > 0 ? "text-red-600 font-semibold" : ""
                }`}
              >
                {r.overdue_count}
              </td>
              <td
                className={`px-3 py-2 text-right tabular-nums ${
                  r.blocked_count > 0 ? "text-red-600 font-semibold" : ""
                }`}
              >
                {r.blocked_count}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {r.owner_full_name ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
