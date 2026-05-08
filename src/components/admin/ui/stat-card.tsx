import Link from "next/link";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "green" | "purple" | "blue" | "amber";

const ACCENT_VARS: Record<Accent, CSSProperties> = {
  green: {
    ["--icon-bg" as string]: "var(--color-srsf-green-50)",
    ["--icon-color" as string]: "var(--color-srsf-green-600)",
  },
  purple: {
    ["--icon-bg" as string]: "var(--color-srsf-purple-50)",
    ["--icon-color" as string]: "var(--color-srsf-purple-600)",
  },
  blue: {
    ["--icon-bg" as string]: "hsl(210 90% 96%)",
    ["--icon-color" as string]: "hsl(210 90% 45%)",
  },
  amber: {
    ["--icon-bg" as string]: "hsl(38 92% 95%)",
    ["--icon-color" as string]: "hsl(38 92% 38%)",
  },
};

export function StatCard({
  label,
  value,
  href,
  hint,
  icon: Icon,
  accent = "green",
}: {
  label: string;
  value: number | string;
  href?: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: Accent;
}) {
  const body = (
    <div
      className={cn(
        "group rounded-[var(--admin-card-radius)] border bg-card p-5 shadow-card transition-smooth hover:shadow-card-hover hover:-translate-y-px",
        `stat-accent-${accent}`,
      )}
      style={ACCENT_VARS[accent]}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {Icon && (
          <div
            className="flex size-8 items-center justify-center rounded-lg transition-smooth group-hover:scale-110"
            style={{ background: "var(--icon-bg)", color: "var(--icon-color)" }}
          >
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className="stat-number mt-2.5 text-[1.85rem] leading-none">{value}</div>
      {hint && (
        <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>
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
