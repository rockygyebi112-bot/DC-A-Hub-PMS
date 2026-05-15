import { Activity, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

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

/* -------------------- Workplan counts -------------------- */

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

/* -------------------- Activity status breakdown -------------------- */

export function ActivityStatusCard({
  notStarted,
  inProgress,
  done,
}: {
  notStarted: number;
  inProgress: number;
  done: number;
}) {
  const total = notStarted + inProgress + done;
  return (
    <PortalCard icon={Activity} label="Activity status">
      <div className="space-y-2">
        <ActivityStatusRow tone="red" label="Not started" value={notStarted} total={total} />
        <ActivityStatusRow tone="amber" label="In progress" value={inProgress} total={total} />
        <ActivityStatusRow tone="green" label="Done" value={done} total={total} />
      </div>
    </PortalCard>
  );
}

function ActivityStatusRow({
  tone,
  label,
  value,
  total,
}: {
  tone: "red" | "amber" | "green";
  label: string;
  value: number;
  total: number;
}) {
  const dot =
    tone === "red"
      ? "bg-red-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-emerald-500";
  const bar =
    tone === "red"
      ? "bg-red-400/70"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-emerald-500";
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
        {label}
      </span>
      <div className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right font-mono text-xs font-bold tabular-nums">
        {value}
      </span>
    </div>
  );
}
