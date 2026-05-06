"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ActivityStatus,
  Project,
  ProjectActivity,
  ProjectActivityUpdate,
  ProjectMilestone,
} from "@/lib/projects/types";
import { listUpdates } from "@/lib/projects/queries";
import {
  createActivity,
  postActivityUpdate,
  updateActivity,
} from "@/lib/projects/mutations";
import {
  computeActivityPercent,
  getChildren,
  normalizePercentComplete,
} from "@/lib/projects/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock3,
  Plus,
  Trash2,
  X,
} from "lucide-react";

interface Props {
  project: Project;
  milestones: ProjectMilestone[];
  activity: ProjectActivity;
  allActivities: ProjectActivity[];
  ownerNameMap?: Record<string, string>;
  currentUserId?: string;
  canPostUpdate: boolean;
  attachmentCount: number;
  onClose: () => void;
  onChange: () => void;
  onAddSubactivity?: (parentId: string) => void;
  onOpenActivity?: (activityId: string) => void;
  onEditActivity?: (activity: ProjectActivity) => void;
  onDelete?: () => void | Promise<void>;
  children?: React.ReactNode;
}

const STATUS_OPTIONS: { value: ActivityStatus; label: string; tone: string }[] =
  [
    {
      value: "not_started",
      label: "Not started",
      tone: "border-[#D3D1C7] bg-[#F1EFE8] text-[#5F5E5A]",
    },
    {
      value: "in_progress",
      label: "In progress",
      tone: "border-[#B5D4F4] bg-[#E6F1FB] text-[#185FA5]",
    },
    {
      value: "done",
      label: "Done",
      tone: "border-[#C0DD97] bg-[#EAF3DE] text-[#3B6D11]",
    },
    {
      value: "blocked",
      label: "Blocked",
      tone: "border-[#F7C1C1] bg-[#FCEBEB] text-[#A32D2D]",
    },
  ];

const PRIORITY_TONES = {
  low: "border-[#D3D1C7] bg-[#F1EFE8] text-[#5F5E5A]",
  medium: "border-[#FAC775] bg-[#FAEEDA] text-[#BA7517]",
  high: "border-[#F7C1C1] bg-[#FCEBEB] text-[#A32D2D]",
} as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "Recently";

  const deltaMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(deltaMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarTone(seed: string) {
  const palette = [
    "bg-[#E6F1FB] text-[#185FA5]",
    "bg-[#EAF3DE] text-[#3B6D11]",
    "bg-[#FAEEDA] text-[#BA7517]",
    "bg-[#FCEBEB] text-[#A32D2D]",
    "bg-[#EEEDFE] text-[#5847C5]",
    "bg-[#E1F5EE] text-[#0D7A52]",
    "bg-[#FBEAF0] text-[#B53D67]",
    "bg-[#F1EFE8] text-[#5F5E5A]",
  ];
  const hash = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

export function ActivitySidePanel({
  project,
  milestones,
  activity,
  allActivities,
  ownerNameMap,
  currentUserId,
  canPostUpdate,
  attachmentCount,
  onClose,
  onChange,
  onAddSubactivity,
  onOpenActivity,
  onEditActivity,
  onDelete,
  children,
}: Props) {
  const isSubActivity = !!activity.parent_activity_id;
  const parentActivity = useMemo(
    () =>
      activity.parent_activity_id
        ? allActivities.find((item) => item.id === activity.parent_activity_id) ??
          null
        : null,
    [activity.parent_activity_id, allActivities],
  );
  const initialMilestoneId =
    activity.milestone_id ?? parentActivity?.milestone_id ?? null;
  const milestoneActivities = useMemo(
    () =>
      allActivities.filter((item) => {
        const itemMilestoneId =
          item.milestone_id ??
          (item.parent_activity_id
            ? allActivities.find((candidate) => candidate.id === item.parent_activity_id)
                ?.milestone_id ?? null
            : null);
        return itemMilestoneId === initialMilestoneId;
      }),
    [allActivities, initialMilestoneId],
  );
  const milestoneProgress = useMemo(() => {
    if (milestoneActivities.length === 0) return 0;
    const completeCount = milestoneActivities.filter(
      (item) => computeActivityPercent(item, allActivities) === 100,
    ).length;
    return Math.round((completeCount / milestoneActivities.length) * 100);
  }, [allActivities, milestoneActivities]);

  const [localActivity, setLocalActivity] = useState(activity);
  const [updates, setUpdates] = useState<ProjectActivityUpdate[]>([]);
  const [note, setNote] = useState("");
  const [newStatus, setNewStatus] = useState<ActivityStatus>(activity.status);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleDraft, setTitleDraft] = useState(activity.title);
  const [descriptionDraft, setDescriptionDraft] = useState(activity.description ?? "");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [showCompletedSubtasks, setShowCompletedSubtasks] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setLocalActivity(activity);
    setTitleDraft(activity.title);
    setDescriptionDraft(activity.description ?? "");
    setNewStatus(activity.status);
    setError(null);
    setAddingSubtask(false);
    setSubtaskTitle("");
    setShowCompletedSubtasks(false);
  }, [activity]);

  useEffect(() => {
    let active = true;

    async function loadUpdates() {
      const next = await listUpdates(activity.id);
      if (active) setUpdates(next);
    }

    void loadUpdates();

    return () => {
      active = false;
    };
  }, [activity.id]);

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  useEffect(() => {
    if (editingDescription) descriptionRef.current?.focus();
  }, [editingDescription]);

  const submitUpdate = useCallback(async () => {
    if (!currentUserId || !note.trim()) return;

    setSubmitting(true);
    setError(null);
    const statusAfter = newStatus;

    try {
      await postActivityUpdate({
        activity_id: localActivity.id,
        user_id: currentUserId,
        note: note.trim(),
        new_status: statusAfter !== localActivity.status ? statusAfter : undefined,
        current_status: localActivity.status,
      });

      const nowIso = new Date().toISOString();
      setLocalActivity((current) => ({
        ...current,
        status: statusAfter,
        percent_complete: normalizePercentComplete(statusAfter),
        last_update_text: note.trim(),
        last_update_at: nowIso,
        updated_at: nowIso,
      }));
      setNote("");
      onChange();
      const fresh = await listUpdates(localActivity.id);
      setUpdates(fresh);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.toLowerCase().includes("proof")
          ? "Upload proof before marking this task done."
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  }, [currentUserId, localActivity, newStatus, note, onChange]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editingInput =
        target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && note.trim()) {
        event.preventDefault();
        void submitUpdate();
        return;
      }

      if (editingInput) return;

      if (event.key.toLowerCase() === "e" && !!onEditActivity) {
        event.preventDefault();
        setEditingTitle(true);
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [note, onClose, onEditActivity, submitUpdate]);

  const childActivities = useMemo(
    () => getChildren(localActivity, allActivities),
    [allActivities, localActivity],
  );
  const incompleteChildren = childActivities.filter((item) => item.status !== "done");
  const completeChildren = childActivities.filter((item) => item.status === "done");
  const resolvedMilestoneId = localActivity.milestone_id ?? initialMilestoneId;
  const milestone =
    milestones.find((item) => item.id === resolvedMilestoneId) ?? null;
  const ownerName =
    ownerNameMap?.[localActivity.owner_user_id ?? ""] ?? "Unassigned";
  const progress = computeActivityPercent(localActivity, allActivities);
  const canEdit = !!onEditActivity;
  const blockDone =
    childActivities.length === 0 &&
    newStatus === "done" &&
    attachmentCount === 0;
  const doneBlocked = childActivities.length === 0 && attachmentCount === 0;
  const lastUpdatedAt = localActivity.last_update_at ?? localActivity.updated_at;

  async function persistPatch(patch: Partial<ProjectActivity>) {
    const previous = localActivity;
    const optimistic = {
      ...previous,
      ...patch,
      updated_at: new Date().toISOString(),
    } as ProjectActivity;

    setLocalActivity(optimistic);
    if (patch.status) setNewStatus(patch.status);

    try {
      const saved = await updateActivity(previous.id, patch);
      setLocalActivity(saved);
      onChange();
      return saved;
    } catch (err) {
      setLocalActivity(previous);
      setNewStatus(previous.status);
      toast.error(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async function saveTitle() {
    const nextTitle = titleDraft.trim();
    setEditingTitle(false);
    if (!nextTitle || nextTitle === localActivity.title) {
      setTitleDraft(localActivity.title);
      return;
    }
    await persistPatch({ title: nextTitle });
  }

  async function saveDescription() {
    const nextDescription = descriptionDraft.trim();
    setEditingDescription(false);
    if ((localActivity.description ?? "") === nextDescription) return;
    await persistPatch({ description: nextDescription || null });
  }

  async function toggleComplete() {
    if (!canPostUpdate) return;
    const nextStatusValue: ActivityStatus =
      localActivity.status === "done" ? "not_started" : "done";

    if (nextStatusValue === "done" && doneBlocked) return;

    await persistPatch({
      status: nextStatusValue,
      percent_complete: normalizePercentComplete(nextStatusValue),
    });
  }

  async function createQuickSubtask() {
    const nextTitle = subtaskTitle.trim();
    if (!currentUserId || !nextTitle) return;

    try {
      await createActivity({
        project_id: project.id,
        milestone_id: resolvedMilestoneId,
        parent_activity_id: localActivity.id,
        title: nextTitle,
        owner_user_id: localActivity.owner_user_id,
        priority: "medium",
        created_by: currentUserId,
      });
      setSubtaskTitle("");
      setAddingSubtask(false);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch">
      <div className="hidden flex-1 bg-black/25 sm:block" onClick={onClose} />

      <aside className="flex h-[92vh] w-full flex-col rounded-t-[18px] border border-[#E5E7EB] bg-white shadow-2xl sm:h-full sm:max-w-[520px] lg:max-w-[640px] sm:rounded-none sm:border-l">
        <div className="flex justify-center py-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-[#D1D5DB]" />
        </div>

        <header className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-white">
          <div className="flex items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#6B7280]">
                {isSubActivity && parentActivity && (
                  <button
                    type="button"
                    onClick={() => onOpenActivity?.(parentActivity.id)}
                    className="rounded p-0.5 text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                )}
                <span className="truncate">{project.name}</span>
                <span>/</span>
                <span className="truncate">{milestone?.name ?? "Ungrouped"}</span>
                {isSubActivity && (
                  <>
                    <span>/</span>
                    <span className="truncate">{parentActivity?.title ?? "Parent"}</span>
                    <span>/</span>
                    <span>Sub-activity</span>
                  </>
                )}
                {!isSubActivity && (
                  <>
                    <div className="mx-1 h-1 w-10 overflow-hidden rounded-full bg-[#E5E7EB]">
                      <div
                        className="h-full rounded-full bg-[#3B6D11]"
                        style={{ width: `${milestoneProgress}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px]">{milestoneProgress}%</span>
                  </>
                )}
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                <Clock3 className="h-3 w-3" />
                Last updated {formatRelativeTime(lastUpdatedAt)}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEditActivity?.(localActivity)}
                  className="h-8 rounded-md border-[#E5E7EB] px-2.5"
                >
                  Edit
                </Button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  className="rounded-md p-2 text-[#A32D2D] transition hover:bg-[#FCEBEB]"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-2 text-[#6B7280] transition hover:bg-[#F3F4F6] hover:text-[#111827]"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-6 px-5 py-5">
              <section className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <button
                    type="button"
                    disabled={!canPostUpdate || (localActivity.status !== "done" && doneBlocked)}
                    onClick={() => void toggleComplete()}
                    className={cn(
                      "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition",
                      localActivity.status === "done"
                        ? "border-[#C0DD97] bg-[#EAF3DE] text-[#3B6D11]"
                        : "border-[#D3D1C7] bg-white text-transparent",
                      (!canPostUpdate || (localActivity.status !== "done" && doneBlocked)) &&
                        "cursor-not-allowed opacity-50",
                    )}
                    title={
                      doneBlocked && localActivity.status !== "done"
                        ? "Upload proof of activity first"
                        : "Toggle complete"
                    }
                  >
                    <Check className="h-4 w-4" />
                  </button>

                  <div className="min-w-0 flex-1">
                    {editingTitle && canEdit ? (
                      <textarea
                        ref={titleRef}
                        value={titleDraft}
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onBlur={() => void saveTitle()}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setTitleDraft(localActivity.title);
                            setEditingTitle(false);
                          }
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void saveTitle();
                          }
                        }}
                        rows={1}
                        className="w-full resize-none border-none bg-transparent p-0 text-[18px] font-semibold text-[#111827] outline-none"
                      />
                    ) : (
                      <h1
                        className={cn(
                          "cursor-pointer text-[18px] font-semibold leading-6 text-[#111827] break-words",
                          localActivity.status === "done" &&
                            "text-[#3B6D11] line-through decoration-[#C0DD97]",
                          !canEdit && "cursor-default",
                        )}
                        onClick={() => canEdit && setEditingTitle(true)}
                      >
                        {localActivity.title || "Task name"}
                      </h1>
                    )}
                  </div>
                </div>

                <div className="pl-10">
                  {editingDescription && canEdit ? (
                    <textarea
                      ref={descriptionRef}
                      value={descriptionDraft}
                      onChange={(event) => setDescriptionDraft(event.target.value)}
                      onBlur={() => void saveDescription()}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setDescriptionDraft(localActivity.description ?? "");
                          setEditingDescription(false);
                        }
                      }}
                      rows={4}
                      className="min-h-[96px] w-full resize-none border-none bg-transparent px-0 py-0 text-sm text-[#111827] outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => canEdit && setEditingDescription(true)}
                      className={cn(
                        "text-left text-sm leading-5",
                        localActivity.description
                          ? "text-[#111827]"
                          : "text-[#9CA3AF]",
                        !canEdit && "cursor-default",
                      )}
                    >
                      {localActivity.description || "Add a description..."}
                    </button>
                  )}
                </div>
              </section>

              {!isSubActivity && (
                <section className="space-y-4 border-t border-[#E5E7EB] pt-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-sm font-semibold text-[#111827]">Subtasks</h2>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-medium",
                          incompleteChildren.length === 0 && childActivities.length > 0
                            ? "bg-[#EAF3DE] text-[#3B6D11]"
                            : "bg-[#F3F4F6] text-[#6B7280]",
                        )}
                      >
                        {completeChildren.length} of {childActivities.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (currentUserId) {
                          setAddingSubtask(true);
                        } else {
                          onAddSubactivity?.(localActivity.id);
                        }
                      }}
                      className="rounded-md px-2 py-1 text-[12px] font-medium text-[#185FA5] transition hover:bg-[#E6F1FB]"
                    >
                      + Add subtask
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {incompleteChildren.map((child) => {
                      const childOwner =
                        ownerNameMap?.[child.owner_user_id ?? ""] ?? "Unassigned";
                      const childOverdue =
                        child.due_date &&
                        child.status !== "done" &&
                        new Date(child.due_date) < new Date();

                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => onOpenActivity?.(child.id)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition hover:bg-[#F9FAFB]"
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                              child.status === "done"
                                ? "border-[#C0DD97] bg-[#EAF3DE] text-[#3B6D11]"
                                : "border-[#D3D1C7] bg-white",
                            )}
                          >
                            {child.status === "done" ? "\u2713" : ""}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-[#111827]">
                            {child.title}
                          </span>
                          {child.due_date && (
                            <span
                              className={cn(
                                "hidden text-[11px] sm:block",
                                childOverdue ? "text-[#A32D2D]" : "text-[#6B7280]",
                              )}
                            >
                              {new Date(child.due_date).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                              getAvatarTone(child.owner_user_id ?? childOwner),
                            )}
                            title={childOwner}
                          >
                            {getInitials(childOwner || "U")}
                          </span>
                        </button>
                      );
                    })}

                    {addingSubtask && (
                      <div className="flex items-center gap-2.5 rounded-lg border border-[#E5E7EB] px-3 py-2.5">
                        <Plus className="h-4 w-4 text-[#9CA3AF]" />
                        <Input
                          value={subtaskTitle}
                          onChange={(event) => setSubtaskTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              setAddingSubtask(false);
                              setSubtaskTitle("");
                            }
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void createQuickSubtask();
                            }
                          }}
                          placeholder="Subtask name"
                          className="h-7 border-none bg-transparent px-0 text-sm shadow-none ring-0"
                        />
                      </div>
                    )}

                    {completeChildren.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowCompletedSubtasks((current) => !current)}
                        className="pt-2 text-[12px] font-medium text-[#6B7280] transition hover:text-[#111827]"
                      >
                        {showCompletedSubtasks
                          ? "Hide completed"
                          : `Show ${completeChildren.length} completed`}
                      </button>
                    )}

                    {showCompletedSubtasks &&
                      completeChildren.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => onOpenActivity?.(child.id)}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition hover:bg-[#F9FAFB]"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#C0DD97] bg-[#EAF3DE] text-[10px] text-[#3B6D11]">
                            {"\u2713"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-[#9CA3AF] line-through">
                            {child.title}
                          </span>
                        </button>
                      ))}
                  </div>
                </section>
              )}

              <section className="space-y-4 border-t border-[#E5E7EB] pt-5">
                <h2 className="text-sm font-semibold text-[#111827]">Activity</h2>

                <div className="space-y-4">
                  {updates.length === 0 ? (
                    <p className="text-[12px] text-[#9CA3AF]">No activity yet.</p>
                  ) : (
                    updates.map((update) => {
                      const changed =
                        (update.status_before || update.status_after) &&
                        update.status_before !== update.status_after;

                      return (
                        <div key={update.id} className="space-y-2">
                          <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
                            <div className="h-1.5 w-1.5 rounded-full bg-[#D1D5DB]" />
                            {formatRelativeTime(update.created_at)}
                          </div>
                          <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm">
                            <p className="whitespace-pre-wrap text-[13px] leading-[1.6] text-[#111827]">
                              {update.note}
                            </p>
                            {changed && (
                              <div className="mt-2.5 flex items-center gap-2 rounded-md bg-[#F3F4F6] px-2 py-1 text-[11px] text-[#6B7280]">
                                <span className="rounded-sm bg-white px-1.5 py-0.5 text-[#9CA3AF]">
                                  {
                                    STATUS_OPTIONS.find(
                                      (item) => item.value === update.status_before,
                                    )?.label
                                  }
                                </span>
                                <span className="text-[#9CA3AF]">→</span>
                                <span className="rounded-sm bg-white px-1.5 py-0.5 font-medium text-[#111827]">
                                  {
                                    STATUS_OPTIONS.find(
                                      (item) => item.value === update.status_after,
                                    )?.label
                                  }
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {canPostUpdate && (
                  <div className="space-y-4 border-t border-[#E5E7EB] pt-4">
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((option) => {
                        const disabled = option.value === "done" && blockDone;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={disabled}
                            onClick={() => setNewStatus(option.value)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
                              newStatus === option.value
                                ? option.tone
                                : "border-[#E5E7EB] bg-white text-[#6B7280]",
                              disabled && "cursor-not-allowed opacity-50",
                            )}
                            title={disabled ? "Upload proof of activity first" : undefined}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    <Textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={3}
                      placeholder="Write a comment or update..."
                      className="min-h-[96px] rounded-xl border-[#E5E7EB] bg-white px-4 py-3 text-[13px]"
                    />

                    {blockDone && (
                      <div className="rounded-lg border border-[#FAC775] bg-[#FAEEDA] px-4 py-2.5 text-[12px] text-[#BA7517]">
                        Upload proof of activity before marking complete.
                      </div>
                    )}

                    {error && (
                      <div className="rounded-lg border border-[#F7C1C1] bg-[#FCEBEB] px-4 py-2.5 text-[12px] text-[#A32D2D]">
                        {error}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNote("");
                          setError(null);
                          setNewStatus(localActivity.status);
                        }}
                        className="h-8 rounded-md border-[#E5E7EB] px-3"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={submitting || !note.trim() || blockDone}
                        onClick={() => void submitUpdate()}
                        className="h-8 rounded-md bg-srsf-green-600 px-3 text-white hover:bg-srsf-green-700"
                      >
                        {submitting ? "Posting..." : "Post update"}
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-5 border-t border-[#E5E7EB] bg-[#F9FAFB] px-5 py-5 lg:border-l lg:border-t-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                    Assignee
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-[#111827]">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold",
                        getAvatarTone(localActivity.owner_user_id ?? ownerName),
                      )}
                    >
                      {getInitials(ownerName || "U")}
                    </span>
                    <span>{ownerName}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                    Due date
                  </div>
                  {canEdit ? (
                    <Input
                      type="date"
                      value={localActivity.due_date ?? ""}
                      onChange={(event) =>
                        void persistPatch({ due_date: event.target.value || null })
                      }
                      className="h-9 rounded-lg border-[#E5E7EB] bg-white px-3 text-[13px]"
                    />
                  ) : (
                    <div className="flex items-center gap-2.5 text-sm text-[#111827]">
                      <CalendarDays className="h-4 w-4 text-[#9CA3AF]" />
                      <span>{localActivity.due_date ? formatDate(localActivity.due_date) : "No date"}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                    Priority
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["low", "medium", "high"] as const).map((priority) => (
                      <button
                        key={priority}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => void persistPatch({ priority })}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[12px] font-medium capitalize",
                          localActivity.priority === priority
                            ? PRIORITY_TONES[priority]
                            : "border-[#E5E7EB] bg-white text-[#6B7280]",
                          !canEdit && "cursor-default",
                        )}
                      >
                        {priority}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                    Status
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((option) => {
                      const disabled =
                        !canPostUpdate || (option.value === "done" && doneBlocked);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            void persistPatch({
                              status: option.value,
                              percent_complete: normalizePercentComplete(option.value),
                            })
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                            localActivity.status === option.value
                              ? option.tone
                              : "border-[#E5E7EB] bg-white text-[#6B7280]",
                            disabled && "cursor-not-allowed opacity-50",
                          )}
                          title={
                            disabled && option.value === "done"
                              ? "Upload proof of activity first"
                              : undefined
                          }
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                    Milestone
                  </div>
                  {canEdit && !isSubActivity ? (
                    <select
                      value={localActivity.milestone_id ?? ""}
                      onChange={(event) =>
                        void persistPatch({ milestone_id: event.target.value || null })
                      }
                      className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-[#111827]"
                    >
                      <option value="">No milestone</option>
                      {milestones.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="truncate text-sm text-[#111827]" title={milestone?.name ?? "No milestone"}>
                      {milestone?.name ?? "No milestone"}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                    Progress
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
                      <div
                        className="h-full rounded-full bg-[#3B6D11] transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-[#6B7280]">{progress}%</span>
                  </div>
                </div>
              </div>

              {children}
            </aside>
          </div>
        </div>
      </aside>
    </div>
  );
}
