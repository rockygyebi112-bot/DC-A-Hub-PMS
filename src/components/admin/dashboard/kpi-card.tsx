import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiAccent = "blue" | "green" | "purple" | "amber" | "cyan";

export type KpiCardProps = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent: KpiAccent;
  /** Period-over-period delta (e.g. 12 means +12%). */
  delta?: number;
  deltaLabel?: string;
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  delta,
  deltaLabel = "from last month",
}: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="rounded-[var(--admin-card-radius)] border bg-card p-4 shadow-card transition-smooth hover:shadow-card-hover">
      <div className="flex items-center gap-3">
        <div className={cn("kpi-tile", `kpi-tile-${accent}`)}>
          <Icon className="size-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="stat-number mt-0.5 text-2xl leading-none">{value}</p>
        </div>
      </div>
      {typeof delta === "number" && (
        <div
          className={cn(
            "mt-3 flex items-center gap-1 text-[11px] font-medium",
            positive ? "text-[hsl(160_64%_32%)]" : "text-[hsl(0_78%_42%)]",
          )}
        >
          {positive ? (
            <ArrowUpRight className="size-3.5" />
          ) : (
            <ArrowDownRight className="size-3.5" />
          )}
          <span>
            {positive ? "+" : ""}
            {delta}%
          </span>
          <span className="text-muted-foreground">{deltaLabel}</span>
        </div>
      )}
    </div>
  );
}
