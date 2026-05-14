"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
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
  inviteStaffMemberSchema,
  type InviteStaffMemberInput,
} from "@/lib/admin/schemas";
import { inviteStaffMember } from "@/lib/admin/actions/members";

/**
 * One-step "invite a staff person to this project" dialog. Mirrors the
 * client-viewer invite, but the server action creates the user as
 * `role='staff'` AND assigns them `project_role='member'` so they get
 * write access (upload workplan, create phases/activities, upload
 * documents) immediately on first sign-in. Previously, inviting a new
 * staff user was a two-step flow (invite via /admin/users, then add
 * them to the project) which was easy to get wrong — admins often added
 * them as `viewer`, making staff indistinguishable from clients.
 */
export function InviteStaffMemberForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<InviteStaffMemberInput>({
    resolver: zodResolver(inviteStaffMemberSchema),
    defaultValues: { email: "", full_name: "" },
  });

  function onSubmit(values: InviteStaffMemberInput) {
    startTransition(async () => {
      const res = await inviteStaffMember(projectId, values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data?.delivery === "password_setup_sent"
          ? `Password setup email sent to ${values.email}`
          : `Staff invite sent to ${values.email}`,
      );
      setOpen(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <UserPlus className="size-4" />
            Invite staff
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite staff to this project</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Creates the user with the <strong>staff</strong> role and grants
          delivery access (upload workplan, edit phases & activities, upload
          documents) on this project.
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
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
                    <Input autoComplete="name" {...field} />
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
