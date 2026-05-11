"use client";

import { useState, useTransition, type ReactNode } from "react";
import { ExternalLink, FileText, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { requestProofAccess } from "@/lib/workspace/actions";

export type ProofAccessButtonProps = {
  proofId: string;
  fileName: string;
  caption?: string | null;
  kind: "file" | "link";
  /** Visible host/url for links; undefined for files. */
  hint?: string | null;
  /**
   * Optional custom trigger. When omitted, a full-width row card is rendered.
   * Pass a small icon button here for tight UIs (e.g. portal side cards).
   */
  trigger?: ReactNode;
};

/**
 * Click-to-confirm gate for opening sensitive attachments. Every click goes
 * through `requestProofAccess` on the server, which re-checks project
 * membership and writes an audit row before returning a short-lived URL.
 *
 * Two-step UX: user clicks the row -> confirm dialog appears -> they must
 * acknowledge the confidentiality notice (and optionally state the purpose)
 * before the URL is fetched and opened in a new tab.
 */
export function ProofAccessButton({
  proofId,
  fileName,
  caption,
  kind,
  hint,
  trigger,
}: ProofAccessButtonProps) {
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const Icon = kind === "link" ? ExternalLink : FileText;

  function reset() {
    setAck(false);
    setPurpose("");
    setPassword("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function confirm() {
    if (!ack) {
      toast.error("Please acknowledge the confidentiality notice");
      return;
    }
    if (!password) {
      toast.error("Enter your account password to continue");
      return;
    }
    startTransition(async () => {
      const res = await requestProofAccess(proofId, password, purpose);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const url = res.data?.url;
      if (!url) {
        toast.error("Could not resolve the document URL");
        return;
      }
      // Use noopener/noreferrer so the new tab can't access window.opener
      // and downstream sites can't see the originating page in Referer.
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) {
        toast.error("Your browser blocked the popup. Allow popups and retry.");
        return;
      }
      toast.success("Opening document — your access has been logged");
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          (trigger as React.ReactElement) ?? (
            <button
              type="button"
              className="flex w-full items-start gap-2 rounded-lg border bg-background p-3 text-left text-sm transition-colors hover:bg-accent"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium">{fileName}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {caption ?? hint ?? (kind === "link" ? "External link" : "Attached file")}
                </span>
              </div>
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Confirm access
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="font-medium">{fileName}</p>
            {hint && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
            )}
          </div>
          <p className="text-muted-foreground">
            This {kind === "link" ? "link" : "document"} is confidential and is
            protected by project access controls. Your view will be recorded
            (who, when, IP, and device) and is visible to administrators and
            project leads.
          </p>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">
              Purpose (optional)
            </label>
            <Input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. audit review, client report preparation"
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="proof-access-password"
              className="block text-xs font-medium text-muted-foreground"
            >
              Confirm with your account password
            </label>
            <Input
              id="proof-access-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your sign-in password"
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirm();
                }
              }}
            />
          </div>
          <label className="flex items-start gap-2">
            <Checkbox
              checked={ack}
              onCheckedChange={(value) => setAck(value === true)}
            />
            <span className="text-xs text-muted-foreground">
              I understand this material is confidential and I am authorised to
              access it for legitimate project work.
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={confirm} disabled={pending || !ack || !password}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Opening…
              </>
            ) : (
              <>Open {kind === "link" ? "link" : "document"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
