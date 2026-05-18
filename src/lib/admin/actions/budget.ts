"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProjectWriter } from "@/lib/auth/guards";
import { validateUpload, sanitizeFileName } from "@/lib/uploads";
import {
  budgetCategorySchema,
  budgetSetupSchema,
  expenseSchema,
} from "@/lib/admin/schemas";
import type { ActionResult } from "@/lib/action-result";
import { dbErrorMessage } from "@/lib/db-errors";
import { insertBudgetCategoryOrdered } from "@/lib/supabase/rpcs";

function revalidateBudget(projectId: string) {
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/projects/${projectId}/budget`);
}

/* -------------------- Budget setup (upsert) ----------------------- */

export async function upsertProjectBudget(
  projectId: string,
  raw: unknown,
): Promise<ActionResult> {
  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;
  const parsed = budgetSetupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = await createClient();
  const { error } = await sb
    .from("project_budgets")
    .upsert(
      {
        project_id: projectId,
        total_amount: parsed.data.total_amount,
        currency: parsed.data.currency,
        notes: parsed.data.notes ?? null,
      },
      { onConflict: "project_id" },
    );
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateBudget(projectId);
  return { ok: true };
}

/* -------------------- Categories --------------------------------- */

export async function createBudgetCategory(
  projectId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;
  const parsed = budgetCategorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  // Atomic ordered insert (migration 0029) — replaces the previous
  // SELECT-max + INSERT pair that raced under concurrent creates.
  const sb = await createClient();
  const { data, error } = await insertBudgetCategoryOrdered(sb, {
    project_id: projectId,
    name: parsed.data.name,
    allocated_amount: parsed.data.allocated_amount,
  });
  if (error || !data) return { ok: false, error: dbErrorMessage(error) };
  revalidateBudget(projectId);
  return { ok: true, data: { id: data.id } };
}

export async function updateBudgetCategory(
  projectId: string,
  categoryId: string,
  raw: unknown,
): Promise<ActionResult> {
  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;
  const parsed = budgetCategorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = await createClient();
  const { error } = await sb
    .from("budget_categories")
    .update({
      name: parsed.data.name,
      allocated_amount: parsed.data.allocated_amount,
    })
    .eq("id", categoryId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateBudget(projectId);
  return { ok: true };
}

export async function deleteBudgetCategory(
  projectId: string,
  categoryId: string,
): Promise<ActionResult> {
  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;
  const sb = await createClient();
  const { error } = await sb
    .from("budget_categories")
    .delete()
    .eq("id", categoryId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateBudget(projectId);
  return { ok: true };
}

/* -------------------- Expenses ----------------------------------- */

type ExpensePayload = {
  fields: unknown;
  receipt?: { fileName: string; mimeType: string; bytes: ArrayBuffer } | null;
};

async function uploadReceipt(
  projectId: string,
  file: { fileName: string; mimeType: string; bytes: ArrayBuffer },
) {
  const validation = validateUpload("receipt", {
    size: file.bytes.byteLength,
    mimeType: file.mimeType,
    fileName: file.fileName,
  });
  if (!validation.ok) throw new Error(validation.error);

  const sb = await createClient();
  const safeName = sanitizeFileName(file.fileName);
  // Use a uuid prefix rather than Date.now() to eliminate collisions and make
  // paths unguessable.
  const path = `projects/${projectId}/expenses/${crypto.randomUUID()}_${safeName}`;
  const { error } = await sb.storage
    .from("receipts")
    .upload(path, file.bytes, {
      contentType: file.mimeType || "application/octet-stream",
      upsert: false,
    });
  if (error) throw error;
  return { path, name: safeName };
}

async function deleteReceipt(path: string | null | undefined) {
  if (!path) return;
  const sb = await createClient();
  await sb.storage.from("receipts").remove([path]);
}

export async function createExpense(
  projectId: string,
  payload: ExpensePayload,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;
  const parsed = expenseSchema.safeParse(payload.fields);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = await createClient();
  const { data: userRes } = await sb.auth.getUser();

  let receipt: { path: string; name: string } | null = null;
  if (payload.receipt) {
    try {
      receipt = await uploadReceipt(projectId, payload.receipt);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Receipt upload failed",
      };
    }
  }

  const { data, error } = await sb
    .from("expenses")
    .insert({
      project_id: projectId,
      category_id: parsed.data.category_id,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      expense_date: parsed.data.expense_date,
      vendor: parsed.data.vendor ?? null,
      description: parsed.data.description ?? null,
      status: parsed.data.status,
      receipt_path: receipt?.path ?? null,
      receipt_name: receipt?.name ?? null,
      created_by: userRes.user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (receipt) await deleteReceipt(receipt.path);
    return { ok: false, error: dbErrorMessage(error) };
  }
  revalidateBudget(projectId);
  return { ok: true, data: { id: data.id } };
}

export async function updateExpense(
  projectId: string,
  expenseId: string,
  payload: ExpensePayload & { replaceReceipt?: boolean; clearReceipt?: boolean },
): Promise<ActionResult> {
  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;
  const parsed = expenseSchema.safeParse(payload.fields);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const sb = await createClient();

  const { data: existing, error: existErr } = await sb
    .from("expenses")
    .select("receipt_path")
    .eq("id", expenseId)
    .eq("project_id", projectId)
    .single();
  if (existErr) return { ok: false, error: dbErrorMessage(existErr) };

  let nextReceipt: { path: string | null; name: string | null } = {
    path: existing.receipt_path,
    name: null,
  };
  if (payload.clearReceipt) {
    await deleteReceipt(existing.receipt_path);
    nextReceipt = { path: null, name: null };
  } else if (payload.replaceReceipt && payload.receipt) {
    try {
      const uploaded = await uploadReceipt(projectId, payload.receipt);
      await deleteReceipt(existing.receipt_path);
      nextReceipt = { path: uploaded.path, name: uploaded.name };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Receipt upload failed",
      };
    }
  }

  const update = {
    category_id: parsed.data.category_id,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    expense_date: parsed.data.expense_date,
    vendor: parsed.data.vendor ?? null,
    description: parsed.data.description ?? null,
    status: parsed.data.status,
    ...(payload.clearReceipt || payload.replaceReceipt
      ? { receipt_path: nextReceipt.path, receipt_name: nextReceipt.name }
      : {}),
  };

  const { error } = await sb
    .from("expenses")
    .update(update)
    .eq("id", expenseId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateBudget(projectId);
  return { ok: true };
}

export async function deleteExpense(
  projectId: string,
  expenseId: string,
): Promise<ActionResult> {
  const auth = await requireProjectWriter(projectId);
  if (!auth.ok) return auth;
  const sb = await createClient();

  const { data: existing } = await sb
    .from("expenses")
    .select("receipt_path")
    .eq("id", expenseId)
    .eq("project_id", projectId)
    .maybeSingle();

  const { error } = await sb
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  if (existing?.receipt_path) await deleteReceipt(existing.receipt_path);
  revalidateBudget(projectId);
  return { ok: true };
}

/* -------------------- FormData adapter (used by client form) ------ */

export async function submitExpenseFormData(
  projectId: string,
  formData: FormData,
): Promise<ActionResult<{ id?: string }>> {
  const expenseId = formData.get("expense_id");
  const fields = {
    category_id: (formData.get("category_id") as string) || "",
    amount: (formData.get("amount") as string) || "",
    currency: (formData.get("currency") as string) || "GHS",
    expense_date: (formData.get("expense_date") as string) || "",
    vendor: (formData.get("vendor") as string) || "",
    description: (formData.get("description") as string) || "",
    status: (formData.get("status") as string) || "incurred",
  };
  const receiptFile = formData.get("receipt");
  let receipt: ExpensePayload["receipt"] = null;
  if (receiptFile instanceof File && receiptFile.size > 0) {
    receipt = {
      fileName: receiptFile.name,
      mimeType: receiptFile.type,
      bytes: await receiptFile.arrayBuffer(),
    };
  }

  if (typeof expenseId === "string" && expenseId.length > 0) {
    const replace = receipt !== null;
    const clear = formData.get("clear_receipt") === "1";
    const res = await updateExpense(projectId, expenseId, {
      fields,
      receipt,
      replaceReceipt: replace,
      clearReceipt: clear,
    });
    return res.ok ? { ok: true, data: {} } : res;
  }

  return await createExpense(projectId, { fields, receipt });
}
