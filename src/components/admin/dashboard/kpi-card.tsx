import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiCardProps = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  /** Optional small line beneath the value (e.g. "+3 vs last week"). */
  sublabel?: string;
  className?: string;
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  sublabel,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--admin-card-radius)] border border-border bg-card p-3 transition-colors sm:p-4",
        "hover:border-foreground/10",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <span className="min-w-0 flex-1 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground sm:text-xs">
          {label}
        </span>
        <Icon className="size-4 shrink-0 text-muted-foreground sm:size-5" aria-hidden />
      </div>
      <div className="stat-number mt-2 text-xl font-semibold leading-none text-foreground tabular-nums sm:text-2xl">
        {value}
      </div>
      {sublabel ? (
        <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
      ) : null}
    </div>
  );
}
