import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ProjectBudget = {
  id: string;
  project_id: string;
  total_amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BudgetCategory = {
  id: string;
  project_id: string;
  name: string;
  allocated_amount: number;
  order_index: number;
  spent_amount: number;
  expense_count: number;
};

export type ExpenseStatus =
  | "planned"
  | "incurred"
  | "reimbursed"
  | "cancelled";

export type Expense = {
  id: string;
  project_id: string;
  category_id: string | null;
  category_name: string | null;
  amount: number;
  currency: string;
  expense_date: string;
  vendor: string | null;
  description: string | null;
  status: ExpenseStatus;
  receipt_path: string | null;
  receipt_name: string | null;
  receipt_signed_url: string | null;
  created_by: string | null;
  created_at: string;
};

export type BudgetSummary = {
  hasBudget: boolean;
  total: number;
  spent: number;
  remaining: number;
  percent: number;
  currency: string;
  expenseCount: number;
  categoryCount: number;
  overBudgetCategories: number;
  byStatus: Record<ExpenseStatus, number>;
};

const STATUSES_COUNTED_AS_SPENT: ExpenseStatus[] = ["incurred", "reimbursed"];

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getProjectBudget(
  projectId: string,
): Promise<ProjectBudget | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("project_budgets")
    .select("id, project_id, total_amount, currency, notes, created_at, updated_at")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, total_amount: toNumber(data.total_amount) };
}

export async function listBudgetCategories(
  projectId: string,
): Promise<BudgetCategory[]> {
  const sb = await createClient();
  const [{ data: cats, error }, { data: expenses }] = await Promise.all([
    sb
      .from("budget_categories")
      .select("id, project_id, name, allocated_amount, order_index")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true })
      .order("name", { ascending: true }),
    sb
      .from("expenses")
      .select("category_id, amount, status")
      .eq("project_id", projectId),
  ]);
  if (error) throw error;
  const totals = new Map<string, { spent: number; count: number }>();
  for (const exp of expenses ?? []) {
    if (!exp.category_id) continue;
    if (!STATUSES_COUNTED_AS_SPENT.includes(exp.status as ExpenseStatus)) continue;
    const cur = totals.get(exp.category_id) ?? { spent: 0, count: 0 };
    cur.spent += toNumber(exp.amount);
    cur.count += 1;
    totals.set(exp.category_id, cur);
  }
  return (cats ?? []).map((c) => {
    const t = totals.get(c.id) ?? { spent: 0, count: 0 };
    return {
      id: c.id,
      project_id: c.project_id,
      name: c.name,
      allocated_amount: toNumber(c.allocated_amount),
      order_index: c.order_index,
      spent_amount: t.spent,
      expense_count: t.count,
    };
  });
}

export async function listExpenses(
  projectId: string,
  opts: { limit?: number; signReceipts?: boolean } = {},
): Promise<Expense[]> {
  const sb = await createClient();
  const q = sb
    .from("expenses")
    .select(
      "id, project_id, category_id, amount, currency, expense_date, vendor, description, status, receipt_path, receipt_name, created_by, created_at, category:budget_categories(id, name)",
    )
    .eq("project_id", projectId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (opts.limit) q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;

  const rows: Expense[] = (data ?? []).map((row) => {
    const category = Array.isArray(row.category)
      ? row.category[0] ?? null
      : row.category ?? null;
    return {
      id: row.id,
      project_id: row.project_id,
      category_id: row.category_id,
      category_name: category?.name ?? null,
      amount: toNumber(row.amount),
      currency: row.currency,
      expense_date: row.expense_date,
      vendor: row.vendor,
      description: row.description,
      status: row.status as ExpenseStatus,
      receipt_path: row.receipt_path,
      receipt_name: row.receipt_name,
      receipt_signed_url: null,
      created_by: row.created_by,
      created_at: row.created_at,
    };
  });

  if (opts.signReceipts) {
    await Promise.all(
      rows.map(async (r) => {
        if (!r.receipt_path) return;
        const { data: signed } = await sb.storage
          .from("receipts")
          .createSignedUrl(r.receipt_path, 60 * 60);
        r.receipt_signed_url = signed?.signedUrl ?? null;
      }),
    );
  }

  return rows;
}

export async function getBudgetSummary(
  projectId: string,
): Promise<BudgetSummary> {
  const sb = await createClient();
  const [budget, expRes, catRes] = await Promise.all([
    getProjectBudget(projectId),
    sb
      .from("expenses")
      .select("amount, status, category_id")
      .eq("project_id", projectId),
    sb
      .from("budget_categories")
      .select("id, allocated_amount")
      .eq("project_id", projectId),
  ]);
  if (expRes.error) throw expRes.error;
  if (catRes.error) throw catRes.error;

  const expenses = expRes.data ?? [];
  const cats = catRes.data ?? [];

  const byStatus: BudgetSummary["byStatus"] = {
    planned: 0,
    incurred: 0,
    reimbursed: 0,
    cancelled: 0,
  };
  for (const e of expenses) {
    byStatus[e.status as ExpenseStatus] += toNumber(e.amount);
  }
  const spent = byStatus.incurred + byStatus.reimbursed;

  // Per-category overspend count
  const catSpend = new Map<string, number>();
  for (const e of expenses) {
    if (!e.category_id) continue;
    if (!STATUSES_COUNTED_AS_SPENT.includes(e.status as ExpenseStatus)) continue;
    catSpend.set(
      e.category_id,
      (catSpend.get(e.category_id) ?? 0) + toNumber(e.amount),
    );
  }
  let overBudgetCategories = 0;
  for (const c of cats) {
    const allocated = toNumber(c.allocated_amount);
    const used = catSpend.get(c.id) ?? 0;
    if (allocated > 0 && used > allocated) overBudgetCategories += 1;
  }

  const total = toNumber(budget?.total_amount ?? 0);
  const remaining = total - spent;
  const percent = total > 0 ? Math.round((spent / total) * 100) : 0;

  return {
    hasBudget: !!budget,
    total,
    spent,
    remaining,
    percent,
    currency: budget?.currency ?? "GHS",
    expenseCount: expenses.length,
    categoryCount: cats.length,
    overBudgetCategories,
    byStatus,
  };
}
