"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMyEmail } from "@/lib/account/actions";

export function EmailForm({
  currentEmail,
  pendingEmail,
}: {
  currentEmail: string;
  pendingEmail: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = email.trim().toLowerCase();
    if (!next) {
      toast.error("Enter a new email");
      return;
    }
    if (next === currentEmail.toLowerCase()) {
      toast.error("That's already your current email");
      return;
    }
    startTransition(async () => {
      const res = await updateMyEmail({ email: next });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        "Confirmation links sent. Check both your current and new inbox to finish the change.",
      );
      setEmail("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="current_email">Current email</Label>
        <Input id="current_email" value={currentEmail} disabled readOnly />
      </div>
      {pendingEmail ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Pending change to <span className="font-medium">{pendingEmail}</span>.
          Click the confirmation link in both inboxes to complete it.
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="new_email">New email</Label>
        <Input
          id="new_email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <p className="text-xs text-muted-foreground">
          We&apos;ll email confirmation links to both your current and new
          address. The change only takes effect once both are confirmed.
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        {pending ? "Sending..." : "Send confirmation"}
      </Button>
    </form>
  );
}
