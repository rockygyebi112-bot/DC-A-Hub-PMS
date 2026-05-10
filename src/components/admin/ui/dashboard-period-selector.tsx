"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type DashboardPeriod = "month" | "quarter" | "ytd";

const OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "ytd", label: "YTD" },
];

export function DashboardPeriodSelector({
  current,
}: {
  current: DashboardPeriod;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(value: DashboardPeriod) {
    if (value === current) return;
    const next = new URLSearchParams(Array.from(params.entries()));
    if (value === "month") next.delete("period");
    else next.set("period", value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="inline-flex rounded-full border border-border bg-background p-0.5">
      {OPTIONS.map((opt) => {
        const active = opt.value === current;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => go(opt.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
