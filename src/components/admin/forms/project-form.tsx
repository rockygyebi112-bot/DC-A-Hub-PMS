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
import { SectionCard } from "@/components/admin/ui/section-card";
import { StickyFormBar } from "@/components/admin/ui/sticky-form-bar";
import { createProject, updateProject } from "@/lib/admin/actions/projects";
import { projectFormSchema, type ProjectFormInput } from "@/lib/admin/schemas";

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
      form.reset(values);
      if (mode === "create" && "data" in result && result.data) {
        router.push(`/admin/projects/${result.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <SectionCard
          title="Basics"
          description="The identifying details shown in admin lists and future workspace pages."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="SOCO" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input placeholder="SOCO" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="client_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick a client">
                          {(value: string) =>
                            clients.find((c) => c.id === value)?.name ?? "Pick a client"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => {
                const statusLabels: Record<string, string> = {
                  planning: "Not started",
                  active: "Ongoing",
                  paused: "Paused",
                  completed: "Done",
                };
                return (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string) => statusLabels[value] ?? value}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="planning">Not started</SelectItem>
                        <SelectItem value="active">Ongoing</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                        <SelectItem value="completed">Done</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          </div>
        </SectionCard>

        <SectionCard title="Schedule" description="Optional dates for planning and reporting.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SectionCard>

        <SectionCard title="Description">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea rows={5} placeholder="What is this project about?" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SectionCard>

        <StickyFormBar visible={form.formState.isDirty || pending}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => form.reset()}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : mode === "create" ? "Create project" : "Save changes"}
          </Button>
        </StickyFormBar>
      </form>
    </Form>
  );
}
