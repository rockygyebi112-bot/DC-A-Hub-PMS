import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { SectionCard } from "@/components/admin/ui/section-card";
import { BudgetSetupForm } from "@/components/admin/forms/budget-setup-form";
import { BudgetCategoryForm } from "@/components/admin/forms/budget-category-form";
import { ExpenseForm } from "@/components/admin/forms/expense-form";
import {
  BudgetKpis,
  BudgetMasterBar,
} from "@/components/admin/budget/budget-kpis";
import { CategoryTable } from "@/components/admin/budget/category-table";
import { ExpenseTable } from "@/components/admin/budget/expense-table";
import { ProjectTabs } from "@/components/admin/project-detail/parts";
import { getProject } from "@/lib/admin/queries";
import {
  getBudgetSummary,
  getProjectBudget,
  listBudgetCategories,
  listExpenses,
} from "@/lib/admin/queries/budget";

export default async function ProjectBudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [projectMaybe, budget, summary, categories, expenses] = await Promise.all([
    getProject(id),
    getProjectBudget(id),
    getBudgetSummary(id),
    listBudgetCategories(id),
    listExpenses(id, { signReceipts: true }),
  ]);
  if (!projectMaybe) notFound();
  const project = projectMaybe;

  const defaultCurrency = budget?.currency ?? "GHS";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href={`/admin/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to project
        </Link>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                Finance
              </h1>
              <StatusPill
                status={
                  project.archived_at
                    ? "archived"
                    : (project.status as "planning" | "active" | "paused" | "completed")
                }
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {project.name} · {project.code}
            </p>
          </div>
          <ExpenseForm
            projectId={id}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            defaultCurrency={defaultCurrency}
          />
        </div>
      </div>

      <ProjectTabs projectId={id} active="budget" />

      {/* KPIs */}
      <BudgetKpis summary={summary} />

      {summary.hasBudget && summary.total > 0 && (
        <BudgetMasterBar summary={summary} />
      )}

      {/* Budget setup */}
      <SectionCard
        title={budget ? "Budget configuration" : "Set up budget"}
        description={
          budget
            ? "Update the total budget and currency for this project."
            : "Define the total budget envelope before adding categories or expenses."
        }
      >
        <BudgetSetupForm
          projectId={id}
          initial={
            budget
              ? {
                  total_amount: budget.total_amount,
                  currency: budget.currency,
                  notes: budget.notes,
                }
              : undefined
          }
        />
      </SectionCard>

      {/* Categories */}
      <SectionCard
        title="Categories"
        description="Allocate the budget across categories. Spend is tracked against each."
        action={categories.length > 0 ? <BudgetCategoryForm projectId={id} /> : undefined}
      >
        <CategoryTable
          projectId={id}
          categories={categories}
          currency={defaultCurrency}
        />
      </SectionCard>

      {/* Expenses */}
      <SectionCard
        title="Expenses"
        description={`${expenses.length} entr${expenses.length === 1 ? "y" : "ies"} · most recent first`}
        action={
          expenses.length > 0 ? (
            <ExpenseForm
              projectId={id}
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              defaultCurrency={defaultCurrency}
            />
          ) : undefined
        }
      >
        <ExpenseTable
          projectId={id}
          expenses={expenses}
          categories={categories}
          defaultCurrency={defaultCurrency}
        />
      </SectionCard>
    </div>
  );
}
