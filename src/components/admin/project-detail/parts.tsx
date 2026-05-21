import Link from "next/link";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------
   Tabs
   ---------------------------------------------------------------- */

export type DetailTabKey =
  | "overview"
  | "team"
  | "budget"
  | "evaluation";

const TABS: { key: DetailTabKey; label: string; href: (id: string) => string }[] = [
  { key: "overview", label: "Overview", href: (id) => `/admin/projects/${id}` },
  { key: "team", label: "Team", href: (id) => `/admin/projects/${id}/team` },
  { key: "budget", label: "Budget", href: (id) => `/admin/projects/${id}/budget` },
  {
    key: "evaluation",
    label: "Data Collection",
    href: (id) => `/admin/projects/${id}/evaluation`,
  },
];

export function ProjectTabs({
  projectId,
  active,
}: {
  projectId: string;
  active: DetailTabKey;
}) {
  return (
    <div className="border-b border-border">
      <nav
        className="-mb-px flex gap-6 overflow-x-auto pl-[max(0px,env(safe-area-inset-left))] pr-[max(0px,env(safe-area-inset-right))]"
        aria-label="Project sections"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href(projectId)}
              className={cn(
                "whitespace-nowrap border-b-2 px-1 pb-3 text-sm transition-colors",
                isActive
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ----------------------------------------------------------------
   Donut progress
   ---------------------------------------------------------------- */

export function ProgressDonut({
  percent,
  size = 84,
  stroke = 8,
  health = "on-track",
}: {
  percent: number;
  size?: number;
  stroke?: number;
  health?: "on-track" | "at-risk" | "delayed" | "not-started";
}) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (safe / 100) * c;
  const color =
    health === "at-risk"
      ? "var(--status-at-risk)"
      : health === "delayed"
        ? "var(--status-delayed)"
        : health === "not-started"
          ? "var(--status-not-started)"
          : "var(--status-on-track)";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--muted)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-heading text-lg font-bold tracking-tight">{safe}%</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
   Next milestones
   ---------------------------------------------------------------- */

export type Milestone = {
  id: string;
  date: Date;
  title: string;
  phase: string;
  health: "on-track" | "at-risk" | "delayed" | "not-started";
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function NextMilestonesCard({
  milestones,
  viewAllHref,
  now,
}: {
  milestones: Milestone[];
  viewAllHref: string;
  now: number;
}) {
  return (
    <section className="rounded-[14px] border bg-card shadow-card">
      <header className="flex items-center justify-between border-b px-5 py-3.5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Next milestones</h2>
        <Link href={viewAllHref} className="text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </header>
      {milestones.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          No upcoming milestones
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {milestones.map((m) => {
            const days = Math.ceil(
              (m.date.getTime() - now) / (1000 * 60 * 60 * 24),
            );
            const dueLabel =
              days === 0
                ? "Due today"
                : days > 0
                  ? `Due in ${days} day${days === 1 ? "" : "s"}`
                  : `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
            const healthLabel: Record<typeof m.health, string> = {
              "on-track": "On Track",
              "at-risk": "At Risk",
              delayed: "Delayed",
              "not-started": "Not Started",
            };
            return (
              <div
                key={m.id}
                className="flex gap-3 rounded-[12px] border bg-background/50 p-3"
              >
                <div className="flex flex-col items-center justify-center rounded-md bg-muted/60 px-2.5 py-2">
                  <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                    {MONTHS[m.date.getMonth()]}
                  </span>
                  <span className="font-heading text-lg font-bold leading-none tracking-tight">
                    {String(m.date.getDate()).padStart(2, "0")}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="line-clamp-1 text-sm font-semibold">{m.title}</p>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">{m.phase}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3" />
                      {dueLabel}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-semibold",
                        m.health === "on-track" && "text-emerald-700",
                        m.health === "at-risk" && "text-amber-700",
                        m.health === "delayed" && "text-red-700",
                        m.health === "not-started" && "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn("size-1.5 rounded-full", `status-dot-${m.health}`)}
                      />
                      {healthLabel[m.health]}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */

// Delegate to the central lib/format helpers (fixed timezone + locale)
// so this surface and every other consumer agree on date / currency
// presentation. Re-exports kept so existing imports don't break.
import {
  formatDate as formatDateBase,
  formatRelative as formatRelativeBase,
} from "@/lib/format/date";
import { formatCurrency as formatCurrencyBase } from "@/lib/format/currency";

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return formatDateBase(value) || value;
}

export function formatRelative(value: string | null | undefined) {
  if (!value) return "—";
  // "just now", "5m ago" — keep the precise short-window phrasing the UI
  // already shows. Anything older falls back to the central relative
  // formatter (so "2 weeks ago" / "last year" speak the same language).
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatRelativeBase(value);
}

export function formatCurrency(amount: number | null | undefined, currency = "GHS") {
  if (amount === null || amount === undefined) return "—";
  return formatCurrencyBase(amount, currency);
}

export function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
