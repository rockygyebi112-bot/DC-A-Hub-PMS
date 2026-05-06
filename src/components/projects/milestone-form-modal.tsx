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
import { createMilestone } from "@/lib/projects/mutations";

interface Props {
  projectId: string;
  nextOrderIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function MilestoneFormModal({
  projectId,
  nextOrderIndex,
  open,
  onOpenChange,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setName("");
    setDescription("");
    setTargetDate("");
    setError(null);
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createMilestone({
        project_id: projectId,
        name,
        description: description || null,
        target_date: targetDate || null,
        order_index: nextOrderIndex,
      });
      setName("");
      setDescription("");
      setTargetDate("");
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
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <form onSubmit={onSubmit}>
          <DialogHeader className="px-5 py-4 border-b">
            <DialogTitle className="text-sm font-semibold">
              New milestone
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 py-4 grid gap-3 max-h-[70vh] overflow-y-auto">
            <div className="grid gap-1.5">
              <Label
                htmlFor="ms-name"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Name
              </Label>
              <Input
                id="ms-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Phase 1 - Applicant Selection"
              />
            </div>

            <div className="grid gap-1.5">
              <Label
                htmlFor="ms-desc"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Description{" "}
                <span className="normal-case text-muted-foreground/60">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="ms-desc"
                rows={2}
                placeholder="What does completing this milestone achieve?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label
                htmlFor="ms-date"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Target date{" "}
                <span className="normal-case text-muted-foreground/60">
                  (optional)
                </span>
              </Label>
              <Input
                id="ms-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
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
              {submitting ? "Saving..." : "Create milestone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
