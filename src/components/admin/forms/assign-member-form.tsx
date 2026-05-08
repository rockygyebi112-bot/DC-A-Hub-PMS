"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { addProjectMember } from "@/lib/admin/actions/members";

type Candidate = { user_id: string; full_name: string; email: string };

export function AssignMemberForm({
  projectId,
  candidates,
  projectRole,
  buttonLabel,
}: {
  projectId: string;
  candidates: Candidate[];
  projectRole: "member" | "viewer";
  buttonLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!userId) {
      toast.error("Pick a user");
      return;
    }
    startTransition(async () => {
      const res = await addProjectMember(projectId, {
        user_id: userId,
        project_role: projectRole,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Added");
      setOpen(false);
      setUserId("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary">{buttonLabel}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{buttonLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>User</Label>
          <Select value={userId || undefined} onValueChange={(v) => setUserId(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a user">
                {(value: string) => {
                  const c = candidates.find((cand) => cand.user_id === value);
                  return c ? `${c.full_name} (${c.email})` : "Pick a user";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {candidates.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No eligible users.
                </div>
              )}
              {candidates.map((c) => (
                <SelectItem key={c.user_id} value={c.user_id}>
                  {c.full_name} ({c.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !userId}>
            {pending ? "Adding..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
