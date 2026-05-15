import {
  AlertTriangle,
  CheckCircle2,
  Receipt,
  TrendingDown,
  Wallet,
} from "lucide-react";
import type { BudgetSummary } from "@/lib/admin/queries/budget";
import { formatMoney } from "./formatters";
import { cn } from "@/lib/utils";

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClasses: Record<string, string> = {
    default: "kpi-tile-blue",
    good: "kpi-tile-green",
    warn: "kpi-tile-amber",
    bad: "bg-red-50 text-red-700",
  };
  return (
    <div className="rounded-[14px] border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="font-heading text-xl font-bold tracking-tight">{value}</p>
          {hint && (
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          )}
        </div>
        <span className={cn("kpi-tile shrink-0", toneClasses[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

export function BudgetKpis({ summary }: { summary: BudgetSummary }) {
  const remainingTone: "good" | "warn" | "bad" =
    summary.total === 0
      ? "good"
      : summary.remaining < 0
        ? "bad"
        : summary.percent > 90
          ? "warn"
          : "good";

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      <KpiCard
        label="Total budget"
        value={formatMoney(summary.total, summary.currency)}
        hint={summary.hasBudget ? "Set" : "Not configured"}
        icon={Wallet}
        tone="default"
      />
      <KpiCard
        label="Spent"
        value={formatMoney(summary.spent, summary.currency)}
        hint={`${summary.percent}% of budget`}
        icon={TrendingDown}
        tone={summary.percent >= 100 ? "bad" : summary.percent >= 80 ? "warn" : "default"}
      />
      <KpiCard
        label="Remaining"
        value={formatMoney(summary.remaining, summary.currency)}
        hint={summary.remaining < 0 ? "Over budget" : "Available"}
        icon={summary.remaining < 0 ? AlertTriangle : CheckCircle2}
        tone={remainingTone}
      />
      <KpiCard
        label="Expenses"
        value={String(summary.expenseCount)}
        hint={`${summary.categoryCount} categor${summary.categoryCount === 1 ? "y" : "ies"} · ${summary.overBudgetCategories} over`}
        icon={Receipt}
        tone={summary.overBudgetCategories > 0 ? "warn" : "default"}
      />
    </div>
  );
}

export function BudgetMasterBar({ summary }: { summary: BudgetSummary }) {
  if (!summary.hasBudget || summary.total <= 0) return null;
  const incurredPct = Math.min(100, (summary.spent / summary.total) * 100);
  const plannedPct = Math.min(
    100 - incurredPct,
    (summary.byStatus.planned / summary.total) * 100,
  );
  const remainPct = Math.max(0, 100 - incurredPct - plannedPct);

  return (
    <div className="rounded-[14px] border bg-card p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold">Budget utilisation</span>
        <span className="text-muted-foreground">
          {summary.percent}% spent
        </span>
      </div>
      <div className="status-bar">
        <span
          style={{ width: `${incurredPct}%`, background: "var(--status-on-track)" }}
          title="Incurred / reimbursed"
        />
        <span
          style={{ width: `${plannedPct}%`, background: "var(--status-at-risk)" }}
          title="Planned"
        />
        <span
          style={{ width: `${remainPct}%`, background: "var(--muted)" }}
          title="Remaining"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ background: "var(--status-on-track)" }} />
          Spent · {formatMoney(summary.spent, summary.currency)}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ background: "var(--status-at-risk)" }} />
          Planned · {formatMoney(summary.byStatus.planned, summary.currency)}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-muted-foreground/30" />
          Remaining · {formatMoney(Math.max(0, summary.remaining), summary.currency)}
        </span>
      </div>
    </div>
  );
}
