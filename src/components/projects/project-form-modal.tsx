"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { createProject, updateProject } from "@/lib/projects/mutations";
import type { Project } from "@/lib/projects/types";
import { DATA_ENTRY_PROGRAMS } from "@/lib/constants";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface UserOption {
  id: string;
  full_name: string | null;
  email: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<Project>;
  onSaved: () => void;
}

export function ProjectFormModal({
  open,
  onOpenChange,
  initial,
  onSaved,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(!!initial?.slug);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [ownerId, setOwnerId] = useState(initial?.owner_user_id ?? "");
  const [programSlug, setProgramSlug] = useState(initial?.program_slug ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [targetEnd, setTargetEnd] = useState(initial?.target_end_date ?? "");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setSlug(initial?.slug ?? "");
    setSlugEdited(!!initial?.slug);
    setDescription(initial?.description ?? "");
    setOwnerId(initial?.owner_user_id ?? "");
    setProgramSlug(initial?.program_slug ?? "");
    setStartDate(initial?.start_date ?? "");
    setTargetEnd(initial?.target_end_date ?? "");
    setError(null);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, role:roles(name)")
        .eq("status", "active")
        .order("full_name", { ascending: true });
      const rows = (data ?? []) as unknown as Array<
        UserOption & { role?: { name?: string } | null }
      >;
      setUsers(
        rows.filter(
          (u) =>
            u.role?.name === "Admin" || u.role?.name === "Program Manager",
        ),
      );
    })();
  }, [open]);

  useEffect(() => {
    if (!slugEdited) setSlug(toSlug(name));
  }, [name, slugEdited]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name,
        slug,
        description: description || null,
        owner_user_id: ownerId || null,
        program_slug: programSlug || null,
        start_date: startDate || null,
        target_end_date: targetEnd || null,
      };
      if (initial?.id) {
        await updateProject(initial.id, payload);
      } else {
        await createProject(payload);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <form onSubmit={onSubmit}>
          <DialogHeader className="px-5 py-4 border-b">
            <DialogTitle className="text-sm font-semibold">
              {initial?.id ? "Edit project" : "New project"}
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 py-4 grid gap-3 max-h-[70vh] overflow-y-auto">
            <div className="grid gap-1.5">
              <Label
                htmlFor="proj-name"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Project name
              </Label>
              <Input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label
                htmlFor="proj-slug"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Slug
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none select-none">
                  /projects/
                </span>
                <Input
                  id="proj-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugEdited(true);
                  }}
                  className="pl-[72px]"
                  required
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label
                htmlFor="proj-desc"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Description
              </Label>
              <Textarea
                id="proj-desc"
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground pt-3 mt-1 border-t border-border">
              Ownership & program
            </p>

            <div className="grid gap-1.5">
              <Label
                htmlFor="proj-owner"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                MEL manager
              </Label>
              <select
                id="proj-owner"
                value={ownerId ?? ""}
                onChange={(e) => setOwnerId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                required
              >
                <option value="">Select owner...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </option>
                ))}
              </select>
              {users.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active MEL managers are available to assign yet.
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label
                htmlFor="proj-program"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Linked program
              </Label>
              <select
                id="proj-program"
                value={programSlug ?? ""}
                onChange={(e) => setProgramSlug(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="">None</option>
                {DATA_ENTRY_PROGRAMS.filter((p) => p.slug !== "learnings").map(
                  (p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name}
                    </option>
                  ),
                )}
              </select>
            </div>

            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground pt-3 mt-1 border-t border-border">
              Timeline
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="proj-start"
                  className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Start date
                </Label>
                <Input
                  id="proj-start"
                  type="date"
                  value={startDate ?? ""}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="proj-end"
                  className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Target end
                </Label>
                <Input
                  id="proj-end"
                  type="date"
                  value={targetEnd ?? ""}
                  onChange={(e) => setTargetEnd(e.target.value)}
                />
              </div>
            </div>

            {error && <div className="text-xs text-red-600">{error}</div>}
          </div>

          <DialogFooter className="px-5 py-3 bg-muted/40 border-t gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-srsf-green-600 hover:bg-srsf-green-700 text-white"
            >
              {submitting
                ? "Saving..."
                : initial?.id
                  ? "Save changes"
                  : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
