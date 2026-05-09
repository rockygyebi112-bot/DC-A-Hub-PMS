import { Folder, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BudgetCategoryForm } from "@/components/admin/forms/budget-category-form";
import { deleteBudgetCategory } from "@/lib/admin/actions/budget";
import type { BudgetCategory } from "@/lib/admin/queries/budget";
import { cn } from "@/lib/utils";
import { formatMoney } from "./formatters";

export function CategoryTable({
  projectId,
  categories,
  currency,
}: {
  projectId: string;
  categories: BudgetCategory[];
  currency: string;
}) {
  if (categories.length === 0) {
    return (
      <EmptyState
        icon={Folder}
        title="No categories yet"
        description="Group expenses with categories like Personnel, Travel, or Equipment to track allocations vs actuals."
        action={<BudgetCategoryForm projectId={projectId} />}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold">Category</th>
            <th className="px-4 py-2.5 text-right font-semibold">Allocated</th>
            <th className="px-4 py-2.5 text-right font-semibold">Spent</th>
            <th className="px-4 py-2.5 text-right font-semibold">Remaining</th>
            <th className="px-4 py-2.5 text-left font-semibold">Utilisation</th>
            <th className="w-24" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {categories.map((cat) => {
            const allocated = cat.allocated_amount;
            const spent = cat.spent_amount;
            const remaining = allocated - spent;
            const percent =
              allocated > 0 ? Math.min(999, Math.round((spent / allocated) * 100)) : 0;
            const over = allocated > 0 && spent > allocated;
            const barColor = over
              ? "bg-red-500"
              : percent >= 80
                ? "bg-amber-500"
                : "bg-primary";
            const barWidth = allocated === 0
              ? spent > 0
                ? 100
                : 0
              : Math.min(100, percent);

            async function remove() {
              "use server";
              await deleteBudgetCategory(projectId, cat.id);
            }

            return (
              <tr key={cat.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="font-medium">{cat.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {cat.expense_count} expense{cat.expense_count === 1 ? "" : "s"}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(allocated, currency)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(spent, currency)}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right tabular-nums font-medium",
                    over && "text-red-600",
                  )}
                >
                  {formatMoney(remaining, currency)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", barColor)}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "w-12 text-[11px] font-semibold tabular-nums",
                        over ? "text-red-600" : "text-muted-foreground",
                      )}
                    >
                      {allocated === 0 ? "—" : `${percent}%`}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <BudgetCategoryForm
                      projectId={projectId}
                      category={{
                        id: cat.id,
                        name: cat.name,
                        allocated_amount: cat.allocated_amount,
                      }}
                    />
                    <form action={remove}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete category"
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
  );
}
