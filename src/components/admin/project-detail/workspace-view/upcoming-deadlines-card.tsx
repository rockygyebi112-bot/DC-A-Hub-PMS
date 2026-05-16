import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { formatDate } from "@/components/admin/project-detail/parts";
import { DaysBadge } from "./badges";
import type { WVMilestone } from "./types";

export function UpcomingDeadlinesCard({
  items,
  viewAllHref,
}: {
  items: WVMilestone[];
  viewAllHref: string;
}) {
  return (
    <section className="rounded-[16px] border border-border bg-card shadow-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h3 className="text-sm font-semibold">Upcoming deadlines</h3>
        <Link
          href={viewAllHref}
          className="text-[11.5px] font-medium text-[var(--color-dca-blue-600)] hover:underline"
        >
          View all
        </Link>
      </header>
      {items.length === 0 ? (
        <div className="px-5 py-6 text-center text-xs text-muted-foreground">
          No upcoming deadlines
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-3 px-5 py-3"
            >
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <CalendarDays className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-xs font-semibold">
                  {m.title}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDate(m.date)}
                </p>
              </div>
              <DaysBadge days={m.daysFromNow} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
