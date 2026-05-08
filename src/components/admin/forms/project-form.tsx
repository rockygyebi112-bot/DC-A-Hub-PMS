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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  projectFormSchema,
  type ProjectFormInput,
} from "@/lib/admin/schemas";
import {
  createProject,
  updateProject,
} from "@/lib/admin/actions/projects";

type Props = {
  mode: "create" | "edit";
  clients: { id: string; name: string }[];
  initial?: ProjectFormInput & { id?: string };
};

export function ProjectForm({ mode, clients, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: initial?.name ?? "",
      code: initial?.code ?? "",
      client_id: initial?.client_id ?? "",
      status: initial?.status ?? "planning",
      description: initial?.description ?? "",
      start_date: initial?.start_date ?? "",
      end_date: initial?.end_date ?? "",
    },
  });

  function onSubmit(values: ProjectFormInput) {
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createProject(values)
          : await updateProject(initial!.id!, values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "create" ? "Project created" : "Project updated");
      if (mode === "create" && "data" in result && result.data) {
        router.push(`/admin/projects/${result.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl><Input placeholder="SOCO" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="code" render={({ field }) => (
          <FormItem>
            <FormLabel>Code</FormLabel>
            <FormControl><Input placeholder="SOCO" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="client_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Client</FormLabel>
            <Select value={field.value || undefined} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Pick a client" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="status" render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="start_date" render={({ field }) => (
            <FormItem>
              <FormLabel>Start date</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="end_date" render={({ field }) => (
            <FormItem>
              <FormLabel>End date</FormLabel>
              <FormControl><Input type="date" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl><Textarea rows={4} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Create" : "Save"}
        </Button>
      </form>
    </Form>
  );
}
