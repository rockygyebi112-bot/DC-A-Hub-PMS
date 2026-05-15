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
    <>
      {/* Mobile: stacked card list with the utilisation bar pulled full-width
          and the money figures laid out as a 3-column compact grid. */}
      <ul className="space-y-2 md:hidden">
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
            <li
              key={cat.id}
              className="rounded-[12px] border bg-card p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat.expense_count} expense{cat.expense_count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
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
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <p className="text-muted-foreground">Allocated</p>
                  <p className="font-medium tabular-nums">{formatMoney(allocated, currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Spent</p>
                  <p className="font-medium tabular-nums">{formatMoney(spent, currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Remaining</p>
                  <p className={cn("font-medium tabular-nums", over && "text-red-600")}>
                    {formatMoney(remaining, currency)}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", barColor)}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "w-12 text-right text-[11px] font-semibold tabular-nums",
                    over ? "text-red-600" : "text-muted-foreground",
                  )}
                >
                  {allocated === 0 ? "—" : `${percent}%`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-hidden rounded-[12px] border md:block">
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
    </>
  );
}
