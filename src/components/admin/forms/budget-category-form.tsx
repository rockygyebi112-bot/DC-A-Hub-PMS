"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  createBudgetCategory,
  updateBudgetCategory,
} from "@/lib/admin/actions/budget";

type Props = {
  projectId: string;
  category?: { id: string; name: string; allocated_amount: number };
  trigger?: React.ReactElement;
};

export function BudgetCategoryForm({ projectId, category, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [amount, setAmount] = useState(
    category ? String(category.allocated_amount) : "",
  );
  const [pending, startTransition] = useTransition();
  const isEdit = !!category;

  function submit() {
    startTransition(async () => {
      const payload = {
        name,
        allocated_amount: amount === "" ? 0 : Number(amount),
      };
      const res = isEdit
        ? await updateBudgetCategory(projectId, category!.id, payload)
        : await createBudgetCategory(projectId, payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Category updated" : "Category added");
      setOpen(false);
      if (!isEdit) {
        setName("");
        setAmount("");
      }
      router.refresh();
    });
  }

  const defaultTrigger = isEdit ? (
    <Button variant="ghost" size="icon-sm" aria-label="Edit category">
      <Pencil className="size-3.5" />
    </Button>
  ) : (
    <Button variant="outline" size="sm">
      <Plus className="size-3.5" />
      Add category
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ?? defaultTrigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit category" : "New budget category"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              placeholder="Personnel, Travel, Equipment..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-amount">Allocated amount</Label>
            <Input
              id="cat-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {pending ? "Saving..." : isEdit ? "Save changes" : "Add category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
