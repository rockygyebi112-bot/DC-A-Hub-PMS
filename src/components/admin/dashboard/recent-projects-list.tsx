import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export type RecentProjectRow = {
  id: string;
  name: string;
  category: string;
  progress: number; // 0-100
  health: "on_track" | "at_risk" | "delayed" | "not_started";
  clientName: string | null;
  clientLogoUrl: string | null;
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

function initialsOf(name: string) {
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "CL";
}

export function RecentProjectsList({
  projects,
  viewAllHref,
}: {
  projects: RecentProjectRow[];
  viewAllHref?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
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
            const logoLabel = p.clientName ?? p.name;
            return (
              <li key={p.id} className="px-4 py-3.5 sm:px-5">
                <Link
                  href={`/admin/projects/${p.id}`}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="flex items-center gap-3 sm:flex-1 sm:min-w-0">
                    <span
                      className={cn(
                        "kpi-tile size-9 shrink-0 rounded-[10px]",
                        TILE[p.accent],
                      )}
                    >
                      {p.clientLogoUrl ? (
                        <Image
                          src={p.clientLogoUrl}
                          alt={`${logoLabel} logo`}
                          width={28}
                          height={24}
                          className="max-h-6 w-auto max-w-7 object-contain"
                        />
                      ) : (
                        <span className="text-[10px] font-semibold tracking-tight">
                          {initialsOf(logoLabel)}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">
                        {p.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.category}
                      </p>
                    </div>
                    {/* Mobile: percentage label on the right of the name row. */}
                    <span className="shrink-0 text-xs font-semibold tabular-nums sm:hidden">
                      {p.progress}%
                    </span>
                  </div>
                  {/* Mobile: full-width progress bar on its own row.
                      Desktop: fixed-width bar with trailing percentage. */}
                  <div className="flex items-center gap-3 sm:w-[44%] sm:max-w-[220px]">
                    <div className="progress-bar-track flex-1">
                      <div
                        className={cn("progress-bar-fill", FILL[p.health])}
                        style={{
                          width: `${Math.max(0, Math.min(100, p.progress))}%`,
                        }}
                      />
                    </div>
                    <span className="hidden w-9 shrink-0 text-right text-xs font-semibold tabular-nums sm:inline">
                      {p.progress}%
                    </span>
                  </div>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </Card>
  );
}
