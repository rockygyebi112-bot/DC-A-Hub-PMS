"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  clientFormSchema,
  type ClientFormInput,
} from "@/lib/admin/schemas";
import {
  createClientOrg,
  updateClientOrg,
} from "@/lib/admin/actions/clients";

type Props = {
  mode: "create" | "edit";
  initial?: ClientFormInput & { id?: string };
};

export function ClientForm({ mode, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: initial?.name ?? "",
      contact_email: initial?.contact_email ?? "",
      logo_url: initial?.logo_url ?? "",
    },
  });

  function onSubmit(values: ClientFormInput) {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createClientOrg(values)
          : await updateClientOrg(initial!.id!, values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "create" ? "Client created" : "Client updated");
      if (mode === "create" && "data" in result && result.data) {
        router.push(`/admin/clients/${result.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. SOCO Foundation" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contact_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="contact@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="logo_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo URL (optional)</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
