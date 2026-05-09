"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { upsertProjectBudget } from "@/lib/admin/actions/budget";
import { budgetSetupSchema, type BudgetSetupInput } from "@/lib/admin/schemas";

type Props = {
  projectId: string;
  initial?: { total_amount: number; currency: string; notes: string | null };
};

export function BudgetSetupForm({ projectId, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<BudgetSetupInput>({
    resolver: zodResolver(budgetSetupSchema),
    defaultValues: {
      total_amount: initial?.total_amount ?? 0,
      currency: initial?.currency ?? "GHS",
      notes: initial?.notes ?? "",
    },
  });

  function onSubmit(values: BudgetSetupInput) {
    startTransition(async () => {
      const res = await upsertProjectBudget(projectId, values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Budget saved");
      form.reset(values);
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-4 sm:grid-cols-3"
      >
        <FormField
          control={form.control}
          name="total_amount"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Total budget</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  onChange={(e) => field.onChange(e.target.value)}
                  value={
                    typeof field.value === "number" || typeof field.value === "string"
                      ? String(field.value)
                      : ""
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Currency</FormLabel>
              <FormControl>
                <Input
                  placeholder="GHS"
                  maxLength={8}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem className="sm:col-span-3">
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Funding source, period, scope notes..."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="sm:col-span-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => form.reset()}
            disabled={pending}
          >
            Reset
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save budget"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
