import Link from "next/link";
import {
  CalendarDays,
  Flag,
  ListChecks,
  Mail,
  TrendingUp,
} from "lucide-react";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortalManager } from "@/lib/portal/queries";

/* -------------------- Donut -------------------- */

function ProgressDonut({
  percent,
  size = 88,
  stroke = 9,
  tone = "good",
}: {
  percent: number;
  size?: number;
  stroke?: number;
  tone?: "good" | "warn" | "bad";
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const dash = (clamped / 100) * c;
  const color =
    tone === "bad"
      ? "var(--status-delayed)"
      : tone === "warn"
        ? "var(--status-at-risk)"
        : "var(--status-on-track)";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-base font-bold tracking-tight">
          {clamped}%
        </span>
      </div>
    </div>
  );
}

/* -------------------- Card shell -------------------- */

function PortalCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

/* -------------------- 1. Overall progress -------------------- */

export function OverallProgressCard({
  done,
  total,
  health = "good",
}: {
  done: number;
  total: number;
  health?: "good" | "warn" | "bad";
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const healthLabel = health === "bad" ? "Delayed" : health === "warn" ? "At risk" : "On track";
  const healthColor =
    health === "bad"
      ? "bg-red-50 text-red-700 border-red-200"
      : health === "warn"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <PortalCard icon={TrendingUp} label="Overall progress">
      <div className="flex items-center gap-3">
        <ProgressDonut percent={percent} tone={health} size={76} stroke={8} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[11px] text-muted-foreground leading-tight">
            {done} / {total} activities completed
          </p>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              healthColor,
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                health === "bad"
                  ? "bg-red-500"
                  : health === "warn"
                    ? "bg-amber-500"
                    : "bg-emerald-500",
              )}
            />
            {healthLabel}
          </span>
        </div>
      </div>
    </PortalCard>
  );
}

/* -------------------- 2. Project timeline -------------------- */

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function getDaysUntil(date: string | null, referenceDate: string) {
  if (!date) return null;
  const ms = new Date(date).getTime() - new Date(referenceDate).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function TimelineCard({
  startDate,
  endDate,
  referenceDate,
}: {
  startDate: string | null;
  endDate: string | null;
  referenceDate: string;
}) {
  const remainingDays = getDaysUntil(endDate, referenceDate);
  return (
    <PortalCard icon={CalendarDays} label="Project timeline">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground">Start date</p>
          <p className="font-heading text-sm font-bold tracking-tight">
            {formatDate(startDate)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">End date</p>
          <p className="font-heading text-sm font-bold tracking-tight">
            {formatDate(endDate)}
          </p>
        </div>
      </div>
      {remainingDays !== null && remainingDays >= 0 && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
            <CalendarDays className="size-3" />
            {remainingDays} day{remainingDays === 1 ? "" : "s"} left
          </span>
        </div>
      )}
    </PortalCard>
  );
}

/* -------------------- 3. Workplan counts -------------------- */

export function WorkplanCard({
  phases,
  activities,
}: {
  phases: number;
  activities: number;
}) {
  return (
    <PortalCard icon={ListChecks} label="Workplan">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-heading text-2xl font-bold tracking-tight">{phases}</p>
          <p className="text-[11px] text-muted-foreground">Phases</p>
        </div>
        <div>
          <p className="font-heading text-2xl font-bold tracking-tight">{activities}</p>
          <p className="text-[11px] text-muted-foreground">Total activities</p>
        </div>
      </div>
    </PortalCard>
  );
}

/* -------------------- 4. Upcoming milestone -------------------- */

export function MilestoneCard({
  title,
  date,
  referenceDate,
}: {
  title: string | null;
  date: string | null;
  referenceDate: string;
}) {
  const inDays = getDaysUntil(date, referenceDate);
  return (
    <PortalCard icon={Flag} label="Upcoming milestone">
      {title ? (
        <div className="space-y-1">
          <p className="line-clamp-2 font-heading text-sm font-bold tracking-tight leading-tight">
            {title}
          </p>
          <p className="text-[11px] text-muted-foreground">{formatDate(date)}</p>
          {inDays !== null && inDays >= 0 && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              <CalendarDays className="size-3" />
              {inDays === 0 ? "Today" : `In ${inDays} day${inDays === 1 ? "" : "s"}`}
            </span>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <p className="font-heading text-sm font-semibold text-muted-foreground">
            None scheduled
          </p>
          <p className="text-[11px] text-muted-foreground">
            All planned milestones complete
          </p>
        </div>
      )}
    </PortalCard>
  );
}

/* -------------------- 5. Project manager -------------------- */

export function ManagerCard({ manager }: { manager: PortalManager | null }) {
  return (
    <PortalCard icon={Mail} label="Project manager">
      {manager ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <UserAvatar name={manager.full_name} email={manager.email} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-bold tracking-tight">
                {manager.full_name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">DC&A Hub</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            render={
              <Link href={`mailto:${manager.email}`}>
                <Mail className="size-3.5" />
                Send message
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground">Not assigned</p>
          <p className="text-[11px] text-muted-foreground">
            Awaiting team assignment
          </p>
        </div>
      )}
    </PortalCard>
  );
}
