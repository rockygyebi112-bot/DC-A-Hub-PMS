import { ExternalLink, Receipt, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpenseForm } from "@/components/admin/forms/expense-form";
import { deleteExpense } from "@/lib/admin/actions/budget";
import type {
  BudgetCategory,
  Expense,
  ExpenseStatus,
} from "@/lib/admin/queries/budget";
import { cn } from "@/lib/utils";
import { formatDate, formatMoney } from "./formatters";

const STATUS_STYLE: Record<ExpenseStatus, string> = {
  planned: "bg-amber-50 text-amber-800 border-amber-200",
  incurred: "bg-blue-50 text-blue-700 border-blue-200",
  reimbursed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<ExpenseStatus, string> = {
  planned: "Planned",
  incurred: "Incurred",
  reimbursed: "Reimbursed",
  cancelled: "Cancelled",
};

export function ExpenseTable({
  projectId,
  expenses,
  categories,
  defaultCurrency,
}: {
  projectId: string;
  expenses: Expense[];
  categories: BudgetCategory[];
  defaultCurrency: string;
}) {
  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No expenses recorded"
        description="Log expenses against this project to track actuals against the budget."
        action={
          <ExpenseForm
            projectId={projectId}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            defaultCurrency={defaultCurrency}
          />
        }
      />
    );
  }

  return (
    <>
      {/* Mobile: stacked card list. Tables with this many columns become a
          horizontal-scroll trap on phones, so we collapse to one card per row
          with the high-signal fields surfaced and the rest tucked into a
          secondary line. */}
      <ul className="space-y-2 md:hidden">
        {expenses.map((exp) => {
          async function remove() {
            "use server";
            await deleteExpense(projectId, exp.id);
          }
          return (
            <li
              key={exp.id}
              className="row-cv-card rounded-[12px] border bg-card p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {exp.vendor || exp.description || "Expense"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(exp.expense_date)}
                    {exp.category_name ? ` · ${exp.category_name}` : ""}
                  </p>
                </div>
                <p className="shrink-0 whitespace-nowrap text-right font-semibold tabular-nums">
                  {formatMoney(exp.amount, exp.currency)}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    STATUS_STYLE[exp.status],
                  )}
                >
                  {STATUS_LABEL[exp.status]}
                </span>
                {exp.receipt_signed_url ? (
                  <a
                    href={exp.receipt_signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    {exp.receipt_name ?? "Receipt"}
                  </a>
                ) : null}
                <div className="ml-auto flex gap-1">
                  <ExpenseForm
                    projectId={projectId}
                    categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                    defaultCurrency={defaultCurrency}
                    initial={{
                      id: exp.id,
                      category_id: exp.category_id,
                      amount: exp.amount,
                      currency: exp.currency,
                      expense_date: exp.expense_date,
                      vendor: exp.vendor,
                      description: exp.description,
                      status: exp.status,
                      receipt_name: exp.receipt_name,
                      receipt_path: exp.receipt_path,
                    }}
                  />
                  <form action={remove}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete expense"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </form>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop: the original wide table. */}
      <div className="hidden overflow-x-auto rounded-[12px] border md:block">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold">Date</th>
            <th className="px-4 py-2.5 text-left font-semibold">Description</th>
            <th className="px-4 py-2.5 text-left font-semibold">Category</th>
            <th className="px-4 py-2.5 text-left font-semibold">Status</th>
            <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
            <th className="px-4 py-2.5 text-left font-semibold">Receipt</th>
            <th className="w-24" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {expenses.map((exp) => {
            async function remove() {
              "use server";
              await deleteExpense(projectId, exp.id);
            }
            return (
              <tr key={exp.id} className="row-cv hover:bg-muted/30">
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                  {formatDate(exp.expense_date)}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {exp.vendor || exp.description || "Expense"}
                  </div>
                  {exp.vendor && exp.description && (
                    <div className="line-clamp-1 text-[11px] text-muted-foreground">
                      {exp.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {exp.category_name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      STATUS_STYLE[exp.status],
                    )}
                  >
                    {STATUS_LABEL[exp.status]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                  {formatMoney(exp.amount, exp.currency)}
                </td>
                <td className="px-4 py-3">
                  {exp.receipt_signed_url ? (
                    <a
                      href={exp.receipt_signed_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      {exp.receipt_name ?? "Receipt"}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <ExpenseForm
                      projectId={projectId}
                      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
                      defaultCurrency={defaultCurrency}
                      initial={{
                        id: exp.id,
                        category_id: exp.category_id,
                        amount: exp.amount,
                        currency: exp.currency,
                        expense_date: exp.expense_date,
                        vendor: exp.vendor,
                        description: exp.description,
                        status: exp.status,
                        receipt_name: exp.receipt_name,
                        receipt_path: exp.receipt_path,
                      }}
                    />
                    <form action={remove}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete expense"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}
