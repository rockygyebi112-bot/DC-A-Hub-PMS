import Link from "next/link";
import { cn } from "@/lib/utils";

export type MilestoneRow = {
  id: string;
  name: string;
  projectName: string;
  date: string; // ISO date
  status: "on_track" | "at_risk" | "delayed" | "not_started";
  href?: string;
};

const PILL: Record<MilestoneRow["status"], { className: string; label: string }> = {
  on_track:    { className: "delivery-pill-on-track",    label: "On Track" },
  at_risk:     { className: "delivery-pill-at-risk",     label: "At Risk" },
  delayed:     { className: "delivery-pill-delayed",     label: "Delayed" },
  not_started: { className: "delivery-pill-not-started", label: "Not Started" },
};

const DOT: Record<MilestoneRow["status"], string> = {
  on_track: "bg-[var(--status-on-track)]",
  at_risk: "bg-[var(--status-at-risk)]",
  delayed: "bg-[var(--status-delayed)]",
  not_started: "bg-[var(--status-not-started)]",
};

function splitDate(iso: string) {
  try {
    const d = new Date(iso);
    return {
      month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
      day: String(d.getDate()).padStart(2, "0"),
    };
  } catch {
    return { month: "", day: "" };
  }
}

export function UpcomingMilestonesTimeline({
  milestones,
  viewAllHref,
}: {
  milestones: MilestoneRow[];
  viewAllHref?: string;
}) {
  return (
    <div className="rounded-[var(--admin-card-radius)] border bg-card shadow-card">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Upcoming Milestones
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
      <div className="px-4 pb-5 sm:px-5">
        {milestones.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No upcoming milestones.
          </p>
        ) : (
          <ol className="relative">
            <span
              aria-hidden
              className="absolute left-[60px] top-3 bottom-3 w-px bg-border"
            />
            {milestones.map((m) => {
              const { month, day } = splitDate(m.date);
              const pill = PILL[m.status];
              const Wrapper = m.href ? Link : "div";
              return (
                <li key={m.id} className="relative flex items-start gap-4 py-3">
                  <div className="flex w-[52px] shrink-0 flex-col items-start text-left">
                    <span className="text-[10px] font-bold tracking-wider text-muted-foreground">
                      {month}
                    </span>
                    <span className="font-heading text-xl font-bold leading-none">
                      {day}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "relative z-10 mt-2.5 size-2.5 shrink-0 rounded-full ring-4 ring-card",
                      DOT[m.status],
                    )}
                  />
                  <Wrapper
                    href={m.href ?? "#"}
                    className="flex min-w-0 flex-1 flex-col items-start gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.projectName}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "delivery-pill shrink-0",
                        pill.className,
                      )}
                    >
                      {pill.label}
                    </span>
                  </Wrapper>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
