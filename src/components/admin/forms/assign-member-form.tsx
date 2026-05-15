"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Users } from "lucide-react";
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
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { cn } from "@/lib/utils";
import { addProjectMembers } from "@/lib/admin/actions/members";

type Candidate = {
  user_id: string;
  full_name: string;
  email: string;
  role?: "admin" | "staff" | "client";
};

/**
 * Multi-select, searchable "assign to project" dialog. Replaces the previous
 * single-pick dropdown so an admin can add many staff (or viewers) in one
 * round-trip and quickly find people by name / email / role.
 */
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
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
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

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of filtered) next.add(c.user_id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function reset() {
    setSelected(new Set());
    setQuery("");
  }

  function submit() {
    if (selected.size === 0) {
      toast.error("Pick at least one user");
      return;
    }
    // Snapshot so we can restore on failure.
    const userIds = Array.from(selected);
    // Eager close: the dialog disappears immediately and the parent page
    // refreshes in the background. If the action fails we re-open with the
    // previous selection so the user can retry without re-picking everyone.
    setOpen(false);
    reset();
    startTransition(async () => {
      const res = await addProjectMembers(projectId, {
        user_ids: userIds,
        project_role: projectRole,
      });
      if (!res.ok) {
        toast.error(res.error);
        setSelected(new Set(userIds));
        setOpen(true);
        return;
      }
      const { added, skipped } = res.data ?? { added: 0, skipped: 0 };
      if (added === 0 && skipped > 0) {
        toast.message("Already on the team", {
          description: `${skipped} already had access.`,
        });
      } else {
        toast.success(
          `Added ${added} ${added === 1 ? "user" : "users"}${skipped ? ` (${skipped} already on the team)` : ""}`,
        );
      }
      router.refresh();
    });
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.user_id));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button variant="secondary">{buttonLabel}</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{buttonLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Search */}
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, email, or role…"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
              autoFocus
            />
          </label>

          {/* Bulk toggle row */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {selected.size} selected · {filtered.length} of {candidates.length} shown
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={allFilteredSelected ? clearSelection : selectAllFiltered}
                disabled={filtered.length === 0}
                className="font-medium text-primary hover:underline disabled:opacity-50"
              >
                {allFilteredSelected ? "Clear" : "Select all visible"}
              </button>
            </div>
          </div>

          {/* Candidate list */}
          <ul className="max-h-72 overflow-y-auto rounded-md border bg-background">
            {candidates.length === 0 ? (
              <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
                <Users className="size-6 opacity-60" />
                No eligible users. Invite people first.
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No matches for &quot;{query}&quot;.
              </li>
            ) : (
              filtered.map((c) => {
                const checked = selected.has(c.user_id);
                return (
                  <li key={c.user_id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50",
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

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || selected.size === 0}>
            {pending
              ? "Adding…"
              : selected.size === 0
                ? "Add"
                : `Add ${selected.size} ${selected.size === 1 ? "user" : "users"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
