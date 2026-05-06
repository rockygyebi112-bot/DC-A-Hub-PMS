"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Project,
  ProjectActivity,
  ProjectMilestone,
} from "@/lib/projects/types";
import { computeActivityPercent } from "@/lib/projects/status";
import { ActivityRow } from "./activity-row";
import { ActivitySidePanel } from "./activity-side-panel";
import { MilestoneFormModal } from "./milestone-form-modal";
import { ActivityFormModal } from "./activity-form-modal";
import { AttachmentsGallery } from "./attachments-gallery";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { deleteActivity, deleteMilestone } from "@/lib/projects/mutations";
import { createClient } from "@/lib/supabase/client";
import { Trash2, Target, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Filter = "all" | "overdue" | "attention" | "mine";

interface Props {
  project: Project;
  milestones: ProjectMilestone[];
  activities: ProjectActivity[];
  onChange: () => void;
}

export function ActivitiesPanel({
  project,
  milestones,
  activities,
  onChange,
}: Props) {
  interface OwnerProfile {
    id: string;
    full_name: string | null;
    email: string | null;
  }

  const { user, isMELManager } = useUser();
  const currentUserId = user?.id;

  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ProjectActivity | null>(
    null,
  );
  const [activityDraftSeed, setActivityDraftSeed] = useState<
    Partial<ProjectActivity> | null
  >(null);
  const [subParentId, setSubParentId] = useState<string | null>(null);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [ownerNameMap, setOwnerNameMap] = useState<Record<string, string>>({});
  const [collapsedMilestones, setCollapsedMilestones] = useState<Set<string>>(
    new Set(),
  );
  const [collapsedActivities, setCollapsedActivities] = useState<Set<string>>(
    new Set(),
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string, ProjectActivity[]>();
    for (const a of activities) {
      if (a.parent_activity_id) {
        const arr = map.get(a.parent_activity_id) ?? [];
        arr.push(a);
        map.set(a.parent_activity_id, arr);
      }
    }
    return map;
  }, [activities]);

  useEffect(() => {
    let active = true;

    async function loadOwners() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true });

      if (!active || error) return;

      const next = Object.fromEntries(
        ((data ?? []) as OwnerProfile[]).map((profile) => [
          profile.id as string,
          profile.full_name || profile.email || "Assigned user",
        ]),
      );
      setOwnerNameMap(next);
    }

    void loadOwners();

    return () => {
      active = false;
    };
  }, []);

  const matchesFilter = (a: ProjectActivity, today: Date): boolean => {
    const self = (() => {
      if (filter === "overdue") {
        return !!(
          a.due_date &&
          a.status !== "done" &&
          new Date(a.due_date) < today
        );
      }
      if (filter === "attention") {
        return a.status === "blocked" || a.priority === "high";
      }
      if (filter === "mine") {
        return !!currentUserId && a.owner_user_id === currentUserId;
      }
      return true;
    })();
    if (self) return true;
    const kids = childrenByParent.get(a.id) ?? [];
    return kids.some((c) => matchesFilter(c, today));
  };

  const today = new Date();
  const topLevel = activities.filter((a) => !a.parent_activity_id);
  const filteredTopLevel = topLevel.filter((a) => matchesFilter(a, today));

  const byMilestone = new Map<string | null, ProjectActivity[]>();
  for (const a of filteredTopLevel) {
    const key = a.milestone_id ?? null;
    byMilestone.set(key, [...(byMilestone.get(key) ?? []), a]);
  }

  const openActivity = openId
    ? activities.find((a) => a.id === openId) ?? null
    : null;

  const canPostUpdate =
    !!openActivity &&
    !!currentUserId &&
    (isMELManager || openActivity.owner_user_id === currentUserId);

  const nextOrderIndex =
    milestones.reduce((m, x) => Math.max(m, x.order_index), -1) + 1;

  const toggleMilestone = (milestoneId: string) => {
    setCollapsedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(milestoneId)) {
        next.delete(milestoneId);
      } else {
        next.add(milestoneId);
      }
      return next;
    });
  };

  const toggleActivity = (activityId: string) => {
    setCollapsedActivities((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  };

  const renderActivity = (
    a: ProjectActivity,
    idx: number,
    arr: ProjectActivity[],
  ) => {
    const kids = childrenByParent.get(a.id) ?? [];
    const visibleKids = kids.filter((c) => matchesFilter(c, today));
    const hasChildren = kids.length > 0;
    const isExpanded = !collapsedActivities.has(a.id);

    return (
      <div key={a.id}>
        <ActivityRow
          activity={a}
          onOpen={setOpenId}
          ownerNameMap={ownerNameMap}
          displayPercent={computeActivityPercent(a, activities)}
          childCount={kids.length}
          isExpanded={isExpanded}
          onToggleExpand={hasChildren ? () => toggleActivity(a.id) : undefined}
        />
        {isExpanded &&
          visibleKids.map((c, childIdx) => (
            <ActivityRow
              key={c.id}
              activity={c}
              onOpen={setOpenId}
              ownerNameMap={ownerNameMap}
              displayPercent={computeActivityPercent(c, activities)}
              indent
              isLastChild={childIdx === visibleKids.length - 1 && idx === arr.length - 1}
            />
          ))}
      </div>
    );
  };

  return (
    <div>
      {isMELManager && (
        <div className="flex flex-wrap justify-end gap-2 mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMilestoneModal(true)}
          >
            Add milestone
          </Button>
          <Button
            size="sm"
            className="bg-srsf-green-600 hover:bg-srsf-green-700 text-white"
            onClick={() => {
              setActivityDraftSeed(null);
              setEditingActivity(null);
              setSubParentId(null);
              setShowActivityModal(true);
            }}
          >
            Add activity
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {(["all", "overdue", "attention", "mine"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "text-[10px] font-medium px-3 py-1 rounded-full border transition-colors",
              filter === f
                ? "bg-srsf-green-600 text-white border-srsf-green-600"
                : "border-border text-muted-foreground hover:text-foreground hover:border-border/80",
            )}
          >
            {{
              all: "All",
              overdue: "Overdue",
              attention: "Needs attention",
              mine: "My activities",
            }[f]}
          </button>
        ))}
      </div>

      {milestones.map((m) => {
        const rows = byMilestone.get(m.id) ?? [];
        const isCollapsed = collapsedMilestones.has(m.id);
        const activityCount = rows.length;
        const completedCount = rows.filter((r) => r.status === "done").length;
        const progress =
          activityCount > 0
            ? Math.round((completedCount / activityCount) * 100)
            : 0;

        if (rows.length === 0 && filter !== "all") return null;

        return (
          <section key={m.id} className="mb-4">
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="bg-muted/40 border-b border-border">
                <button
                  onClick={() => toggleMilestone(m.id)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/60 transition-colors group"
                  style={{ minHeight: "var(--milestone-header-h)" }}
                >
                  <span className="text-muted-foreground text-[10px] w-3 shrink-0">
                    {isCollapsed ? "\u25B6" : "\u25BC"}
                  </span>

                  <span className="flex items-center justify-center w-[26px] h-[26px] rounded-[7px] bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 shrink-0">
                    <Target className="w-3.5 h-3.5" />
                  </span>

                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {m.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {completedCount} of {activityCount} complete
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <div className="w-[60px] h-[4px] rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          background:
                            progress === 100 ? "#16a34a" : "#3B6D11",
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-foreground w-7 text-right">
                      {progress}%
                    </span>
                  </div>

                  {isMELManager && (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivityDraftSeed({ milestone_id: m.id });
                          setEditingActivity(null);
                          setSubParentId(null);
                          setShowActivityModal(true);
                        }}
                        className="p-1.5 rounded text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                        title="Add activity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (
                            !confirm(
                              `Delete milestone "${m.name}"? Activities under it will become Ungrouped.`,
                            )
                          ) {
                            return;
                          }
                          try {
                            await deleteMilestone(m.id);
                            onChange();
                          } catch (err) {
                            alert(
                              err instanceof Error ? err.message : String(err),
                            );
                          }
                        }}
                        className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                        title="Delete milestone"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </button>
              </div>

              {!isCollapsed && (
                rows.length === 0 ? (
                  <div className="px-4 py-5 text-[11px] text-muted-foreground">
                    No activities in this milestone yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {rows.map(renderActivity)}
                  </div>
                )
              )}
            </div>
          </section>
        );
      })}

      {(byMilestone.get(null)?.length ?? 0) > 0 && (
        <section className="mb-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <h3 className="text-xs font-semibold text-foreground">
                Ungrouped activities
              </h3>
            </div>
            <div className="divide-y divide-border/40">
              {(byMilestone.get(null) ?? []).map(renderActivity)}
            </div>
          </div>
        </section>
      )}

      {filteredTopLevel.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No activities match this filter.
        </div>
      )}

      {openActivity && (
        <ActivitySidePanel
          project={project}
          milestones={milestones}
          activity={openActivity}
          allActivities={activities}
          ownerNameMap={ownerNameMap}
          currentUserId={currentUserId}
          canPostUpdate={canPostUpdate}
          attachmentCount={attachmentCount}
          onClose={() => {
            setOpenId(null);
            setAttachmentCount(0);
          }}
          onChange={onChange}
          onAddSubactivity={
            isMELManager
              ? (parentId) => {
                  setActivityDraftSeed(null);
                  setEditingActivity(null);
                  setSubParentId(parentId);
                  setShowActivityModal(true);
                }
              : undefined
          }
          onOpenActivity={setOpenId}
          onEditActivity={
            isMELManager
              ? (item) => {
                  setEditingActivity(item);
                  setSubParentId(item.parent_activity_id);
                  setShowActivityModal(true);
                }
              : undefined
          }
          onDelete={
            isMELManager
              ? async () => {
                  if (!openActivity) return;
                  const childCount =
                    childrenByParent.get(openActivity.id)?.length ?? 0;
                  const msg =
                    childCount > 0
                      ? `Delete "${openActivity.title}" and its ${childCount} sub-activit${childCount === 1 ? "y" : "ies"}? This cannot be undone.`
                      : `Delete "${openActivity.title}"? This cannot be undone.`;
                  if (!confirm(msg)) return;
                  try {
                    await deleteActivity(openActivity.id);
                    setOpenId(null);
                    onChange();
                  } catch (err) {
                    alert(err instanceof Error ? err.message : String(err));
                  }
                }
              : undefined
          }
        >
          {currentUserId && (
            <AttachmentsGallery
              projectId={project.id}
              activityId={openActivity.id}
              currentUserId={currentUserId}
              canUpload={
                isMELManager || openActivity.owner_user_id === currentUserId
              }
              canDelete={isMELManager}
              onChange={onChange}
              onCountChange={setAttachmentCount}
            />
          )}
        </ActivitySidePanel>
      )}

      {isMELManager && (
        <>
          <MilestoneFormModal
            projectId={project.id}
            nextOrderIndex={nextOrderIndex}
            open={showMilestoneModal}
            onOpenChange={setShowMilestoneModal}
            onSaved={onChange}
          />
          {currentUserId && (
            <ActivityFormModal
              projectId={project.id}
              milestones={milestones}
              parentCandidates={topLevel}
              currentUserId={currentUserId}
              open={showActivityModal}
              onOpenChange={(o) => {
                setShowActivityModal(o);
                if (!o) {
                  setSubParentId(null);
                  setEditingActivity(null);
                  setActivityDraftSeed(null);
                }
              }}
              initial={editingActivity ?? activityDraftSeed ?? undefined}
              fixedParentId={subParentId ?? undefined}
              onSaved={onChange}
            />
          )}
        </>
      )}
    </div>
  );
}
