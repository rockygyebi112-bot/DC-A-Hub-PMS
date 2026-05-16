"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitExpenseFormData } from "@/lib/admin/actions/budget";

export type ExpenseFormCategory = { id: string; name: string };

export type ExpenseFormInitial = {
  id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  expense_date: string;
  vendor: string | null;
  description: string | null;
  status: "planned" | "incurred" | "reimbursed" | "cancelled";
  receipt_name: string | null;
  receipt_path: string | null;
};

type Props = {
  projectId: string;
  categories: ExpenseFormCategory[];
  defaultCurrency: string;
  initial?: ExpenseFormInitial;
  trigger?: React.ReactElement;
};

const STATUS_LABEL: Record<ExpenseFormInitial["status"], string> = {
  planned: "Planned",
  incurred: "Incurred",
  reimbursed: "Reimbursed",
  cancelled: "Cancelled",
};

export function ExpenseForm({
  projectId,
  categories,
  defaultCurrency,
  initial,
  trigger,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = !!initial;

  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [amount, setAmount] = useState(
    initial ? String(initial.amount) : "",
  );
  const [currency, setCurrency] = useState(
    initial?.currency ?? defaultCurrency ?? "GHS",
  );
  const [date, setDate] = useState(
    initial?.expense_date ?? new Date().toISOString().slice(0, 10),
  );
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<ExpenseFormInitial["status"]>(
    initial?.status ?? "incurred",
  );
  const [file, setFile] = useState<File | null>(null);
  const [clearReceipt, setClearReceipt] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setCategoryId(initial?.category_id ?? "");
    setAmount(initial ? String(initial.amount) : "");
    setCurrency(initial?.currency ?? defaultCurrency ?? "GHS");
    setDate(initial?.expense_date ?? new Date().toISOString().slice(0, 10));
    setVendor(initial?.vendor ?? "");
    setDescription(initial?.description ?? "");
    setStatus(initial?.status ?? "incurred");
    setFile(null);
    setClearReceipt(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function submit() {
    if (!amount || Number(amount) <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }
    // Build the FormData now so we can close the dialog before awaiting.
    const fd = new FormData();
    if (initial?.id) fd.set("expense_id", initial.id);
    fd.set("category_id", categoryId);
    fd.set("amount", amount);
    fd.set("currency", currency);
    fd.set("expense_date", date);
    fd.set("vendor", vendor);
    fd.set("description", description);
    fd.set("status", status);
    if (file) fd.set("receipt", file);
    if (clearReceipt) fd.set("clear_receipt", "1");

    // Snapshot for restore-on-failure.
    const snapshot = {
      categoryId, amount, currency, date, vendor, description, status,
      file, clearReceipt,
    };
    // Eager close — dialog disappears immediately, server work runs in
    // background. If it fails we re-open with the previous values so the
    // user doesn't have to re-enter everything.
    setOpen(false);
    reset();
    startTransition(async () => {
      const res = await submitExpenseFormData(projectId, fd);
      if (!res.ok) {
        toast.error(res.error);
        setCategoryId(snapshot.categoryId);
        setAmount(snapshot.amount);
        setCurrency(snapshot.currency);
        setDate(snapshot.date);
        setVendor(snapshot.vendor);
        setDescription(snapshot.description);
        setStatus(snapshot.status);
        setFile(snapshot.file);
        setClearReceipt(snapshot.clearReceipt);
        setOpen(true);
        return;
      }
      toast.success(isEdit ? "Expense updated" : "Expense added");
      router.refresh();
    });
  }

  const defaultTrigger = isEdit ? (
    <Button variant="ghost" size="icon-sm" aria-label="Edit expense">
      <Pencil className="size-3.5" />
    </Button>
  ) : (
    <Button>
      <Plus className="size-4" />
      Add expense
    </Button>
  );

  const existingReceiptName = initial?.receipt_name ?? null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ?? defaultTrigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense" : "Record expense"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Category</Label>
            <Select
              value={categoryId || "__none"}
              onValueChange={(v) => setCategoryId(v === "__none" ? "" : (v ?? ""))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Uncategorised" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Uncategorised</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-amount">Amount</Label>
            <Input
              id="exp-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-currency">Currency</Label>
            <Input
              id="exp-currency"
              maxLength={8}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-date">Date</Label>
            <Input
              id="exp-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus((v ?? "incurred") as ExpenseFormInitial["status"])}
            >
              <SelectTrigger>
                <SelectValue>
                  {(value: string) => STATUS_LABEL[value as ExpenseFormInitial["status"]]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="incurred">Incurred</SelectItem>
                <SelectItem value="reimbursed">Reimbursed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="exp-vendor">Vendor / payee</Label>
            <Input
              id="exp-vendor"
              placeholder="Who was paid"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="exp-desc">Description</Label>
            <Textarea
              id="exp-desc"
              rows={2}
              placeholder="What this covers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Receipt</Label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setClearReceipt(false);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-3.5" />
                {file
                  ? "Change file"
                  : existingReceiptName && !clearReceipt
                    ? "Replace receipt"
                    : "Attach receipt"}
              </Button>
              {file ? (
                <span className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs">
                  {file.name}
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    aria-label="Remove file"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ) : existingReceiptName && !clearReceipt ? (
                <span className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs">
                  {existingReceiptName}
                  <button
                    type="button"
                    onClick={() => setClearReceipt(true)}
                    aria-label="Remove receipt"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">No file selected</span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={pending || !amount || !date}>
            {pending ? "Saving..." : isEdit ? "Save changes" : "Add expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
