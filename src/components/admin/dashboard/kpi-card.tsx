import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiAccent = "blue" | "green" | "purple" | "amber" | "cyan";

export type KpiCardProps = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent: KpiAccent;
};

export function KpiCard({ label, value, icon: Icon, accent }: KpiCardProps) {
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
    </div>
  );
}
