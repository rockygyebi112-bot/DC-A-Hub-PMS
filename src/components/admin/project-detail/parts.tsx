import Link from "next/link";
import {
  Activity,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Flag,
  Hash,
  ListChecks,
  Tag,
  User,
  Users,
} from "lucide-react";
import { AvatarStack, type StackedUser } from "@/components/ui/avatar-stack";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------
   Tabs
   ---------------------------------------------------------------- */

export type DetailTabKey =
  | "overview"
  | "workplan"
  | "team"
  | "timeline"
  | "documents"
  | "budget"
  | "risks"
  | "activity";

const TABS: { key: DetailTabKey; label: string; href: (id: string) => string }[] = [
  { key: "overview", label: "Overview", href: (id) => `/admin/projects/${id}` },
  { key: "workplan", label: "Workplan", href: (id) => `/workspace/projects/${id}` },
  { key: "team", label: "Team", href: (id) => `/admin/projects/${id}/team` },
  { key: "timeline", label: "Timeline", href: (id) => `/admin/projects/${id}` },
  { key: "documents", label: "Documents", href: (id) => `/admin/projects/${id}` },
  { key: "budget", label: "Budget", href: (id) => `/admin/projects/${id}` },
  { key: "risks", label: "Risks", href: (id) => `/admin/projects/${id}` },
  { key: "activity", label: "Activity", href: (id) => `/admin/projects/${id}` },
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
      <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Project sections">
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
   Summary cards row
   ---------------------------------------------------------------- */

function SummaryCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-semibold tracking-tight">{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SummaryProgressCard({
  done,
  total,
  health,
}: {
  done: number;
  total: number;
  health: "on-track" | "at-risk" | "delayed" | "not-started";
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const healthLabel: Record<typeof health, string> = {
    "on-track": "On track",
    "at-risk": "At risk",
    delayed: "Delayed",
    "not-started": "Not started",
  };
  return (
    <SummaryCard icon={Activity} label="Project Progress">
      <div className="flex items-center gap-3">
        <ProgressDonut percent={percent} health={health} />
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">
            {done} / {total} activities
          </p>
          <span className={cn("delivery-pill", `delivery-pill-${health}`)}>
            <span className={cn("size-[6px] rounded-full", `status-dot-${health}`)} />
            {healthLabel[health]}
          </span>
        </div>
      </div>
    </SummaryCard>
  );
}

export function SummaryTimelineCard({
  startDate,
  endDate,
  remainingDays,
}: {
  startDate: string | null;
  endDate: string | null;
  remainingDays: number | null;
}) {
  return (
    <SummaryCard icon={Calendar} label="Timeline">
      <div className="space-y-2">
        <div>
          <p className="text-[11px] text-muted-foreground">Start date</p>
          <p className="text-sm font-semibold">{formatDate(startDate)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">End date</p>
          <p className="text-sm font-semibold">{formatDate(endDate)}</p>
        </div>
        {remainingDays !== null && (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
              remainingDays > 30
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : remainingDays >= 0
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {remainingDays >= 0 ? `${remainingDays} days left` : `${Math.abs(remainingDays)} days overdue`}
          </span>
        )}
      </div>
    </SummaryCard>
  );
}

export function SummaryWorkplanCard({
  phases,
  activities,
}: {
  phases: number;
  activities: number;
}) {
  return (
    <SummaryCard icon={ListChecks} label="Workplan">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-heading text-2xl font-bold tracking-tight">{phases}</p>
          <p className="text-[11px] text-muted-foreground">Phases</p>
        </div>
        <div>
          <p className="font-heading text-2xl font-bold tracking-tight">{activities}</p>
          <p className="text-[11px] text-muted-foreground">Activities</p>
        </div>
      </div>
    </SummaryCard>
  );
}

export function SummaryBudgetCard({
  total,
  spent,
}: {
  total: number | null;
  spent: number | null;
}) {
  const hasBudget = total !== null && total > 0;
  const percent = hasBudget ? Math.min(100, Math.round(((spent ?? 0) / (total as number)) * 100)) : 0;
  return (
    <SummaryCard icon={DollarSign} label="Budget">
      {hasBudget ? (
        <div className="space-y-2">
          <div>
            <p className="font-heading text-base font-bold tracking-tight">
              {formatCurrency(total)}
            </p>
            <p className="text-[11px] text-muted-foreground">Total budget</p>
          </div>
          <div>
            <p className="text-sm font-semibold">{formatCurrency(spent ?? 0)}</p>
            <p className="text-[11px] text-muted-foreground">Spent ({percent}%)</p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground">Not set</p>
          <p className="text-[11px] text-muted-foreground">Add a budget plan</p>
        </div>
      )}
    </SummaryCard>
  );
}

export function SummaryTeamCard({
  members,
  projectId,
}: {
  members: StackedUser[];
  projectId: string;
}) {
  return (
    <SummaryCard icon={Users} label="Team">
      <div className="space-y-2">
        <div>
          <p className="font-heading text-2xl font-bold tracking-tight">{members.length}</p>
          <p className="text-[11px] text-muted-foreground">Members</p>
        </div>
        {members.length > 0 ? (
          <AvatarStack users={members} max={4} size="sm" />
        ) : (
          <Link
            href={`/admin/projects/${projectId}/team`}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            Add members <ChevronRight className="size-3" />
          </Link>
        )}
      </div>
    </SummaryCard>
  );
}

export function SummaryClientCard({
  clientName,
  clientId,
}: {
  clientName: string | null;
  clientId: string | null;
}) {
  return (
    <SummaryCard icon={Building2} label="Client">
      <div className="space-y-2">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {clientName ?? "No client"}
        </p>
        {clientId && (
          <Link
            href={`/admin/clients/${clientId}`}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            View client <ChevronRight className="size-3" />
          </Link>
        )}
      </div>
    </SummaryCard>
  );
}

/* ----------------------------------------------------------------
   Project details (metadata card)
   ---------------------------------------------------------------- */

function MetaField({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export type ProjectDetailsProps = {
  code: string;
  status: string;
  priority?: string | null;
  managerName?: string | null;
  managerEmail?: string | null;
  clientName?: string | null;
  department?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  tags?: string[];
};

export function ProjectDetailsCard(props: ProjectDetailsProps) {
  const tags = props.tags ?? [];
  const visibleTags = tags.slice(0, 3);
  const overflow = tags.length - visibleTags.length;
  return (
    <section className="rounded-[14px] border bg-card shadow-card">
      <header className="border-b px-5 py-3.5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Project details</h2>
      </header>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 p-5">
        <MetaField icon={Hash} label="Project Code">
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{props.code}</code>
        </MetaField>
        <MetaField icon={Activity} label="Status">
          <span className="text-sm font-medium capitalize">{props.status}</span>
        </MetaField>
        <MetaField icon={Flag} label="Priority">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <span className="size-2 rounded-full bg-amber-500" />
            {props.priority ?? "Medium"}
          </span>
        </MetaField>
        <MetaField icon={User} label="Project Manager">
          {props.managerName ? (
            <div className="flex items-center gap-2">
              <UserAvatar
                name={props.managerName}
                email={props.managerEmail ?? props.managerName}
                size="sm"
              />
              <span className="truncate text-sm font-medium">{props.managerName}</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Unassigned</span>
          )}
        </MetaField>
        <MetaField icon={Building2} label="Client">
          <span className="line-clamp-2 text-sm leading-snug">{props.clientName ?? "—"}</span>
        </MetaField>
        <MetaField icon={Briefcase} label="Department">
          <span className="text-sm">{props.department ?? "—"}</span>
        </MetaField>
        <MetaField icon={Calendar} label="Created">
          <span className="text-sm">{formatDate(props.createdAt)}</span>
        </MetaField>
        <MetaField icon={Clock} label="Last Updated">
          <span className="text-sm">{formatRelative(props.updatedAt)}</span>
        </MetaField>
        <div className="col-span-2">
          <MetaField icon={Tag} label="Tags">
            {tags.length === 0 ? (
              <span className="text-sm text-muted-foreground">No tags</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {visibleTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground"
                  >
                    {tag}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    +{overflow}
                  </span>
                )}
              </div>
            )}
          </MetaField>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------
   Recent activity
   ---------------------------------------------------------------- */

export type RecentActivityItem = {
  id: string;
  actorName: string;
  actorEmail: string;
  text: string;
  when: string;
  tone?: "blue" | "green" | "amber" | "gray";
};

export function RecentActivityCard({
  items,
  viewAllHref,
}: {
  items: RecentActivityItem[];
  viewAllHref: string;
}) {
  return (
    <section className="rounded-[14px] border bg-card shadow-card">
      <header className="flex items-center justify-between border-b px-5 py-3.5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Recent activity</h2>
        <Link
          href={viewAllHref}
          className="text-xs font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </header>
      {items.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          No activity yet
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-5 py-3.5">
              <UserAvatar name={item.actorName} email={item.actorEmail} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">
                  <span className="font-semibold">{item.actorName}</span>{" "}
                  <span className="text-foreground/80">{item.text}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.when}</p>
              </div>
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  item.tone === "green" && "bg-emerald-500",
                  item.tone === "amber" && "bg-amber-500",
                  item.tone === "gray" && "bg-muted-foreground/50",
                  (!item.tone || item.tone === "blue") && "bg-blue-500",
                )}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------
   Workplan overview
   ---------------------------------------------------------------- */

export type PhaseRow = {
  id: string;
  name: string;
  done: number;
  total: number;
};

function phaseStatus(done: number, total: number): {
  label: string;
  pillClass: string;
  barClass: string;
} {
  if (total === 0) {
    return {
      label: "Not Started",
      pillClass: "delivery-pill delivery-pill-not-started",
      barClass: "bg-muted-foreground/40",
    };
  }
  if (done === total) {
    return {
      label: "Completed",
      pillClass: "delivery-pill delivery-pill-on-track",
      barClass: "bg-emerald-500",
    };
  }
  if (done === 0) {
    return {
      label: "Not Started",
      pillClass: "delivery-pill delivery-pill-not-started",
      barClass: "bg-muted-foreground/40",
    };
  }
  return {
    label: "In Progress",
    pillClass:
      "delivery-pill bg-blue-50 text-blue-700 border-blue-200",
    barClass: "bg-primary",
  };
}

export function WorkplanOverviewCard({
  phases,
  projectId,
}: {
  phases: PhaseRow[];
  projectId: string;
}) {
  return (
    <section className="rounded-[14px] border bg-card shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="space-y-0.5">
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            Workplan overview
          </h2>
          <p className="text-xs text-muted-foreground">
            Track progress of project phases and activities.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/workspace/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <ListChecks className="size-3.5" /> Manage workplan
          </Link>
          <Link
            href={`/portal/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Users className="size-3.5" /> Client view
          </Link>
        </div>
      </header>

      {phases.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No phases yet. Build your workplan to see progress here.
        </div>
      ) : (
        <ul className="divide-y">
          {phases.map((phase, idx) => {
            const percent =
              phase.total === 0 ? 0 : Math.round((phase.done / phase.total) * 100);
            const status = phaseStatus(phase.done, phase.total);
            return (
              <li
                key={phase.id}
                className="grid grid-cols-12 items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30"
              >
                <div className="col-span-12 flex items-center gap-3 sm:col-span-5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {idx + 1}.
                  </span>
                  <span className="truncate text-sm font-medium">{phase.name}</span>
                </div>
                <div className="col-span-6 text-xs text-muted-foreground sm:col-span-2">
                  {phase.done} / {phase.total} activities
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", status.barClass)}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums">
                      {percent}%
                    </span>
                  </div>
                </div>
                <div className="col-span-10 sm:col-span-2">
                  <span className={status.pillClass}>{status.label}</span>
                </div>
                <div className="col-span-2 flex justify-end sm:col-span-1">
                  <ChevronDown className="size-4 text-muted-foreground" />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="border-t px-5 py-3 text-center">
        <Link
          href={`/workspace/projects/${projectId}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          View full workplan
        </Link>
      </footer>
    </section>
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
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
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

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function formatRelative(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return formatDate(value);
}

export function formatCurrency(amount: number | null | undefined, currency = "GHS") {
  if (amount === null || amount === undefined) return "—";
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
