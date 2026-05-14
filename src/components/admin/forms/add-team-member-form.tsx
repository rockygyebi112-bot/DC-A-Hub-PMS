"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Search, Users } from "lucide-react";
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
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { cn } from "@/lib/utils";
import { addTeamMembers } from "@/lib/admin/actions/members";

type Candidate = {
  user_id: string;
  full_name: string;
  email: string;
  role?: "admin" | "staff" | "client";
};

/**
 * Single combined "Add staff" / "Add client" dialog that replaces the four
 * earlier buttons. Lets an admin:
 *   - Multi-select any number of existing eligible users
 *   - OR/AND invite ONE brand-new user by typing email + (optional) name
 *   - For staff only: optionally promote a single new addition to PM
 *
 * The server action handles inviting the new user with the correct global
 * role (staff vs client), upserting project_members rows with the right
 * project_role, and demoting any prior PM if a new one is being set.
 */
export function AddTeamMemberForm({
  projectId,
  kind,
  candidates,
  hasManager,
}: {
  projectId: string;
  kind: "staff" | "client";
  candidates: Candidate[];
  hasManager: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [makeManager, setMakeManager] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.role ?? "").toLowerCase().includes(q),
    );
  }, [candidates, query]);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function reset() {
    setSelected(new Set());
    setQuery("");
    setInviteEmail("");
    setInviteName("");
    setMakeManager(false);
  }

  // PM toggle is only meaningful for staff and only when a single user is
  // being added in this batch (one existing pick OR one invite, not both).
  const totalAdds =
    selected.size + (inviteEmail.trim().length > 0 ? 1 : 0);
  const canMakeManager = kind === "staff" && totalAdds === 1;

  function submit() {
    if (totalAdds === 0) {
      toast.error("Pick a user or enter an invite email");
      return;
    }
    startTransition(async () => {
      const res = await addTeamMembers(projectId, {
        kind,
        existing_user_ids: Array.from(selected),
        invite_email: inviteEmail.trim() || undefined,
        invite_full_name: inviteName.trim() || undefined,
        make_manager: canMakeManager && makeManager,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const { added, skipped, invited, delivery, promotedManager } = res.data ?? {
        added: 0,
        skipped: 0,
        invited: 0 as 0 | 1,
        promotedManager: false,
      };
      const parts: string[] = [];
      if (added > 0) {
        parts.push(`Added ${added} ${added === 1 ? "user" : "users"}`);
      }
      if (invited > 0) {
        parts.push(
          delivery === "password_setup_sent"
            ? `password setup email sent to ${inviteEmail.trim()}`
            : `invite sent to ${inviteEmail.trim()}`,
        );
      }
      if (skipped > 0) {
        parts.push(`${skipped} already on the team`);
      }
      if (promotedManager) parts.push("promoted to project manager");
      toast.success(parts.join(" · ") || "Team updated");
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  const triggerLabel = kind === "staff" ? "Add staff" : "Add client";
  const dialogTitle =
    kind === "staff" ? "Add staff to this project" : "Add client to this project";
  const helperText =
    kind === "staff"
      ? "Staff get write access — they can upload the workplan, edit phases & activities, and upload documents."
      : "Clients get read-only progress visibility through the client portal.";
  const inviteSectionTitle =
    kind === "staff" ? "Or invite a new staff person" : "Or invite a new client";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button>{triggerLabel}</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{helperText}</p>

        <div className="space-y-3">
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                kind === "staff"
                  ? "Search existing staff…"
                  : "Search existing clients…"
              }
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </label>

          <ul className="max-h-56 overflow-y-auto rounded-md border bg-background">
            {candidates.length === 0 ? (
              <li className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
                <Users className="size-6 opacity-60" />
                No eligible {kind === "staff" ? "staff" : "clients"} yet.
                Use the invite section below.
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                No matches for &quot;{query}&quot;.
              </li>
            ) : (
              filtered.map((c) => {
                const checked = selected.has(c.user_id);
                return (
                  <li key={c.user_id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-accent/50",
                        checked && "bg-accent/40",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(c.user_id)}
                      />
                      <UserAvatar email={c.email} name={c.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.email}
                        </p>
                      </div>
                      {c.role && (
                        <span className="shrink-0 rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {c.role}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {inviteSectionTitle}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              placeholder="Full name (optional)"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            We&apos;ll email an invite link. They&apos;ll join with the{" "}
            <strong>{kind === "staff" ? "staff" : "client"}</strong> role and be
            added to this project.
          </p>
        </div>

        {kind === "staff" && (
          <label
            className={cn(
              "flex items-start gap-2 rounded-md border p-3 text-sm",
              canMakeManager ? "bg-background" : "bg-muted/30 opacity-70",
            )}
          >
            <Checkbox
              checked={makeManager}
              onCheckedChange={(v) => setMakeManager(Boolean(v))}
              disabled={!canMakeManager}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Crown className="size-3.5 text-amber-500" />
                Make project manager
              </span>
              <span className="block text-xs text-muted-foreground">
                {canMakeManager
                  ? hasManager
                    ? "Replaces the current project manager (they stay on the team as a member)."
                    : "Designates this person as the PM. Only one PM per project."
                  : "Available only when adding exactly one staff person."}
              </span>
            </span>
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || totalAdds === 0}>
            {pending
              ? "Saving…"
              : totalAdds === 0
                ? triggerLabel
                : `${triggerLabel} (${totalAdds})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
