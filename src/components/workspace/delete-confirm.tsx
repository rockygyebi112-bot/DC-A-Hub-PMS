"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmWord?: string;
  confirmLabel?: string;
  redirectTo?: string;
  action: () => Promise<{ ok: boolean; error?: string }>;
};

export function DeleteConfirm({
  trigger,
  title,
  description,
  confirmWord,
  confirmLabel = "Delete",
  redirectTo,
  action,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();

  const wordOk = confirmWord ? typed.trim().toUpperCase() === confirmWord.toUpperCase() : true;

  function onConfirm() {
    start(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Delete failed");
        return;
      }
      toast.success(`${title} deleted`);
      setOpen(false);
      setTyped("");
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-4" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {confirmWord && (
          <div className="space-y-1.5 text-sm">
            <p className="text-muted-foreground">
              Type <span className="font-mono font-semibold text-foreground">{confirmWord}</span> to confirm.
            </p>
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!wordOk || pending}
          >
            {pending ? "Deleting…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
