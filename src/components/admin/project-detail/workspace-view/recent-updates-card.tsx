import Link from "next/link";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WVUpdate } from "./types";

export function RecentUpdatesCard({
  items,
  viewAllHref,
}: {
  items: WVUpdate[];
  viewAllHref: string;
}) {
  return (
    <section className="rounded-[16px] border border-border bg-card shadow-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h3 className="text-sm font-semibold">Recent updates</h3>
        <Link
          href={viewAllHref}
          className="text-[11.5px] font-medium text-[var(--color-dca-blue-600)] hover:underline"
        >
          View all
        </Link>
      </header>
      {items.length === 0 ? (
        <div className="px-5 py-6 text-center text-xs text-muted-foreground">
          No recent activity
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((u) => (
            <li key={u.id} className="flex items-start gap-3 px-5 py-3">
              <span
                className={cn(
                  "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md",
                  u.tone === "green" && "bg-emerald-50 text-emerald-600",
                  u.tone === "blue" && "bg-blue-50 text-blue-600",
                  u.tone === "amber" && "bg-amber-50 text-amber-600",
                  u.tone === "gray" && "bg-muted text-muted-foreground",
                )}
              >
                <Paperclip className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-medium leading-snug">
                  {u.text}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  by {u.actor}
                </p>
              </div>
              <span className="shrink-0 text-[10.5px] text-muted-foreground">
                {u.when}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
