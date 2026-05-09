import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type RecentProjectRow = {
  id: string;
  name: string;
  category: string;
  progress: number; // 0-100
  health: "on_track" | "at_risk" | "delayed" | "not_started";
  icon: LucideIcon;
  accent: "blue" | "green" | "amber" | "cyan" | "purple";
};

const TILE: Record<RecentProjectRow["accent"], string> = {
  blue: "kpi-tile-blue",
  green: "kpi-tile-green",
  amber: "kpi-tile-amber",
  cyan: "kpi-tile-cyan",
  purple: "kpi-tile-purple",
};

const FILL: Record<RecentProjectRow["health"], string> = {
  on_track: "progress-bar-fill-on-track",
  at_risk: "progress-bar-fill-at-risk",
  delayed: "progress-bar-fill-delayed",
  not_started: "progress-bar-fill-not-started",
};

export function RecentProjectsList({
  projects,
  viewAllHref,
}: {
  projects: RecentProjectRow[];
  viewAllHref?: string;
}) {
  return (
    <div className="rounded-[var(--admin-card-radius)] border bg-card shadow-card">
      <header className="flex items-center justify-between gap-3 px-5 py-4">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Recent Projects
        </h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        )}
      </header>
      <ul className="divide-y border-t">
        {projects.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-muted-foreground">
            No projects yet.
          </li>
        ) : (
          projects.map((p) => {
            const Icon = p.icon;
            return (
              <li key={p.id} className="px-5 py-3.5">
                <Link
                  href={`/admin/projects/${p.id}`}
                  className="flex items-center gap-3"
                >
                  <span className={cn("kpi-tile size-9 rounded-[10px]", TILE[p.accent])}>
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.category}</p>
                  </div>
                  <div className="flex w-[44%] max-w-[220px] items-center gap-3">
                    <div className="progress-bar-track flex-1">
                      <div
                        className={cn("progress-bar-fill", FILL[p.health])}
                        style={{ width: `${Math.max(0, Math.min(100, p.progress))}%` }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums">
                      {p.progress}%
                    </span>
                  </div>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
