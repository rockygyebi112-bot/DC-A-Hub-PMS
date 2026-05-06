import { TrendingUp, TrendingDown } from "lucide-react";

type AccentColor = "green" | "purple" | "blue" | "amber" | "teal" | "pink";

interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; label: string };
  accent?: AccentColor;
  colorAccent?: string;
  sublabel?: string;
}

const ACCENT_BORDER: Record<AccentColor, string> = {
  green: "border-t-[3px] border-t-[#5BBF3A]",
  purple: "border-t-[3px] border-t-[#6B2D7B]",
  blue: "border-t-[3px] border-t-blue-500",
  amber: "border-t-[3px] border-t-amber-400",
  teal: "border-t-[3px] border-t-teal-500",
  pink: "border-t-[3px] border-t-pink-500",
};

const ACCENT_DOT: Record<AccentColor, string> = {
  green: "bg-[#5BBF3A]/15 dark:bg-[#5BBF3A]/10",
  purple: "bg-[#6B2D7B]/15 dark:bg-[#6B2D7B]/10",
  blue: "bg-blue-500/15 dark:bg-blue-500/10",
  amber: "bg-amber-400/15 dark:bg-amber-400/10",
  teal: "bg-teal-500/15 dark:bg-teal-500/10",
  pink: "bg-pink-500/15 dark:bg-pink-500/10",
};

const ACCENT_VALUE: Record<AccentColor, string> = {
  green: "text-[#3d9922] dark:text-[#6dd647]",
  purple: "text-[#7c3aed] dark:text-[#a78bfa]",
  blue: "text-blue-700 dark:text-blue-400",
  amber: "text-amber-700 dark:text-amber-400",
  teal: "text-teal-700 dark:text-teal-400",
  pink: "text-pink-700 dark:text-pink-400",
};

export function KpiCard({
  label,
  value,
  trend,
  accent,
  colorAccent,
  sublabel,
}: KpiCardProps) {
  const borderClass = accent ? ACCENT_BORDER[accent] : "border-t-[3px] border-t-gray-200 dark:border-t-gray-700";
  const dotClass = accent ? ACCENT_DOT[accent] : "";
  const valueClass = accent ? ACCENT_VALUE[accent] : "text-foreground";

  return (
    <div
      className={`relative rounded-xl border border-border bg-card px-4 py-3 overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 ease-out ${borderClass}`}
    >
      {dotClass && (
        <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-60 pointer-events-none ${dotClass}`} />
      )}
      {colorAccent && (
        <div
          className="absolute left-0 top-0 h-full w-[3px] rounded-l-lg"
          style={{ background: colorAccent }}
        />
      )}
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <p className={`text-3xl font-black mt-2 tracking-tight ${valueClass}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sublabel && (
        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sublabel}</p>
      )}
      {trend && (
        <div className="flex items-center gap-1.5 mt-3">
          {trend.value >= 0 ? (
            <TrendingUp className="size-3.5 text-emerald-500" />
          ) : (
            <TrendingDown className="size-3.5 text-red-500" />
          )}
          <span
            className={`text-xs font-semibold ${
              trend.value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
            }`}
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value.toFixed(1)}%
          </span>
          <span className="text-[11px] text-muted-foreground/60">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
