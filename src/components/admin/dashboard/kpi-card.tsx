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
        "rounded-[var(--admin-card-radius)] border border-border bg-card p-4 transition-colors",
        "hover:border-foreground/10",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="stat-number mt-2 text-2xl font-semibold leading-none text-foreground tabular-nums">
        {value}
      </div>
      {sublabel ? (
        <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
      ) : null}
    </div>
  );
}
