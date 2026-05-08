import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  href,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  href?: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  const body = (
    <div className="rounded-[var(--admin-card-radius)] border bg-card p-5 shadow-sm transition-colors hover:bg-accent/30">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-muted-foreground">{label}</div>
        {Icon && (
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className={cn("block")}>
      {body}
    </Link>
  );
}
