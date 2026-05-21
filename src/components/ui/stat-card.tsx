import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  description?: string;
  trend?: { value: string; direction: "up" | "down" | "flat" };
}

const trendStyles = {
  up: { icon: ArrowUpRight, className: "text-emerald-600 dark:text-emerald-400" },
  down: { icon: ArrowDownRight, className: "text-destructive" },
  flat: { icon: Minus, className: "text-muted-foreground" },
} as const;

/**
 * Dashboard metric tile: a labelled value with an optional icon, trend
 * indicator, and supporting description. Built on Card.
 */
export function StatCard({
  label,
  value,
  icon,
  description,
  trend,
}: StatCardProps) {
  const TrendIcon = trend ? trendStyles[trend.direction].icon : null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        {trend && TrendIcon && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              trendStyles[trend.direction].className,
            )}
          >
            <TrendIcon className="size-3.5" aria-hidden />
            {trend.value}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </Card>
  );
}
