"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { createActivity, updateActivity } from "@/lib/projects/mutations";
import type {
  ActivityPriority,
  ProjectActivity,
  ProjectMilestone,
} from "@/lib/projects/types";
import { cn } from "@/lib/utils";
import { CalendarDays, Flag, FolderTree, LayoutList, UserRound, X } from "lucide-react";

interface UserOption {
  id: string;
  full_name: string | null;
  email: string;
}

interface Props {
  projectId: string;
  milestones: ProjectMilestone[];
  parentCandidates?: ProjectActivity[];
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<ProjectActivity>;
  fixedParentId?: string;
  onSaved: () => void;
}

const PRIORITY_STYLES: Record<ActivityPriority, string> = {
  low: "border-[#D3D1C7] bg-[#F1EFE8] text-[#5F5E5A]",
  medium: "border-[#FAC775] bg-[#FAEEDA] text-[#BA7517]",
  high: "border-[#F7C1C1] bg-[#FCEBEB] text-[#A32D2D]",
};

export function ActivityFormModal({
  projectId,
  milestones,
  parentCandidates = [],
  currentUserId,
  open,
  onOpenChange,
  initial,
  fixedParentId,
  onSaved,
}: Props) {
  const resolvedParentId = fixedParentId ?? initial?.parent_activity_id ?? "";
  const parentActivity = useMemo(
    () =>
      resolvedParentId
        ? parentCandidates.find((candidate) => candidate.id === resolvedParentId) ??
          null
        : null,
    [parentCandidates, resolvedParentId],
  );
  const isSubActivity = !!resolvedParentId;
  const isEdit = !!initial?.id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ActivityPriority>("medium");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setMilestoneId(
      isSubActivity ? parentActivity?.milestone_id ?? "" : initial?.milestone_id ?? "",
    );
    setOwnerId(initial?.owner_user_id ?? "");
    setDueDate(initial?.due_date ?? "");
    setPriority(initial?.priority ?? "medium");
    setError(null);
  }, [open, initial, isSubActivity, parentActivity]);

  useEffect(() => {
    if (!open) return;

    let active = true;

    async function loadUsers() {
      const supabase = createClient();
      const { data } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .eq("status", "active")
        .order("full_name", { ascending: true });

      if (active) setUsers((data ?? []) as UserOption[]);
    }

    void loadUsers();

    return () => {
      active = false;
    };
  }, [open]);

  const milestone = milestones.find((item) => item.id === milestoneId) ?? null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ownerId) {
      setError("Select an owner.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const patch = {
        title,
        description: description || null,
        milestone_id: isSubActivity ? parentActivity?.milestone_id ?? null : milestoneId || null,
        parent_activity_id: isSubActivity ? resolvedParentId : null,
        owner_user_id: ownerId || null,
        due_date: dueDate || null,
        priority,
      };

      if (initial?.id) {
        await updateActivity(initial.id, patch);
      } else {
        await createActivity({
          project_id: projectId,
          ...patch,
          created_by: currentUserId,
        });
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
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-1/2 w-full max-w-[calc(100%-1rem)] -translate-x-1/2 translate-y-0 rounded-t-[20px] rounded-b-none border border-[#E5E7EB] bg-white p-0 sm:top-1/2 sm:bottom-auto sm:max-w-[640px] sm:-translate-y-1/2 sm:rounded-[12px]"
      >
        <form onSubmit={onSubmit}>
          <DialogHeader className="border-b border-[#E5E7EB] px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F4F6] text-[#374151]">
                  {isSubActivity ? (
                    <FolderTree className="h-4.5 w-4.5" />
                  ) : (
                    <LayoutList className="h-4.5 w-4.5" />
                  )}
                </div>
                <div className="space-y-1">
                  <span className="inline-flex rounded-full border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B7280]">
                    {isSubActivity ? "Sub-activity" : "Activity"}
                  </span>
                  <DialogTitle className="text-lg font-semibold text-[#111827]">
                    {isEdit
                      ? isSubActivity
                        ? "Edit sub-activity"
                        : "Edit activity"
                      : isSubActivity
                        ? "New sub-activity"
                        : "New activity"}
                  </DialogTitle>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md p-1 text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </DialogHeader>

          <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              {isSubActivity && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                      Parent
                    </div>
                    <div className="mt-1 text-sm text-[#111827]">
                      {parentActivity?.title ?? "Parent activity"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                      Milestone
                    </div>
                    <div className="mt-1 text-sm text-[#111827]">
                      {milestone?.name ?? "No milestone"}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="activity-title" className="text-sm font-medium text-[#111827]">
                  Title
                </Label>
                <Input
                  id="activity-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Task name"
                  required
                  className="h-11 rounded-lg border-[#E5E7EB] bg-white px-3"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="activity-description" className="text-sm font-medium text-[#111827]">
                  Description
                </Label>
                <Textarea
                  id="activity-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Add a description..."
                  className="min-h-[112px] rounded-lg border-[#E5E7EB] bg-white px-3 py-2.5"
                />
              </div>

              {!isSubActivity && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-[#111827]">Milestone</Label>
                  <Select
                    value={milestoneId || "__none__"}
                    onValueChange={(value) =>
                      setMilestoneId(value === "__none__" ? "" : (value ?? ""))
                    }
                  >
                    <SelectTrigger className="h-11 rounded-lg border-[#E5E7EB] bg-white px-3">
                      <SelectValue placeholder="Select milestone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No milestone</SelectItem>
                      {milestones.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-2 text-sm font-medium text-[#111827]">
                    <UserRound className="h-4 w-4 text-[#9CA3AF]" />
                    Owner
                  </Label>
                  <Select
                    value={ownerId || "__none__"}
                    onValueChange={(value) =>
                      setOwnerId(value === "__none__" ? "" : (value ?? ""))
                    }
                  >
                    <SelectTrigger className="h-11 rounded-lg border-[#E5E7EB] bg-white px-3">
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select owner</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="activity-due-date"
                    className="flex items-center gap-2 text-sm font-medium text-[#111827]"
                  >
                    <CalendarDays className="h-4 w-4 text-[#9CA3AF]" />
                    Due date
                  </Label>
                  <Input
                    id="activity-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="h-11 rounded-lg border-[#E5E7EB] bg-white px-3"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-sm font-medium text-[#111827]">
                  <Flag className="h-4 w-4 text-[#9CA3AF]" />
                  Priority
                </Label>
                <div className="flex flex-wrap gap-2">
                  {(["low", "medium", "high"] as ActivityPriority[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPriority(item)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium capitalize transition",
                        priority === item
                          ? PRIORITY_STYLES[item]
                          : "border-[#E5E7EB] bg-white text-[#6B7280]",
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-[#F7C1C1] bg-[#FCEBEB] px-3 py-2 text-sm text-[#A32D2D]">
                  {error}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="m-0 rounded-none border-t border-[#E5E7EB] bg-white px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-lg border-[#E5E7EB] px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !ownerId}
              className="h-10 rounded-lg bg-srsf-green-600 px-4 text-white hover:bg-srsf-green-700"
            >
              {submitting
                ? "Saving..."
                : isEdit
                  ? "Save"
                  : isSubActivity
                    ? "Create sub-activity"
                    : "Create activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
