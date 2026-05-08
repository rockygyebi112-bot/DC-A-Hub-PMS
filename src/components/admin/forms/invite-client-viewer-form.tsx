"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  inviteClientViewerSchema,
  type InviteClientViewerInput,
} from "@/lib/admin/schemas";
import { inviteClientViewer } from "@/lib/admin/actions/members";

export function InviteClientViewerForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<InviteClientViewerInput>({
    resolver: zodResolver(inviteClientViewerSchema),
    defaultValues: { email: "", full_name: "" },
  });

  function onSubmit(values: InviteClientViewerInput) {
    startTransition(async () => {
      const res = await inviteClientViewer(projectId, values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Invite sent to ${values.email}`);
      setOpen(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Invite client viewer</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite client viewer</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Inviting..." : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
