import {
  ArrowLeft,
  CalendarDays,
  CircleCheck,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { DeleteConfirm } from "@/components/workspace/delete-confirm";
import { UpdateComposer } from "@/components/workspace/update-composer";
import { DetailsCard } from "./activity-detail-view/details-card";
import { EditCard } from "./activity-detail-view/edit-card";
import { NotesCard } from "./activity-detail-view/notes-card";
import { StripCell } from "./activity-detail-view/primitives";
import { TimelineCard } from "./activity-detail-view/timeline-card";
import { UpdatesCard } from "./activity-detail-view/updates-card";
import { UploadsCard } from "./activity-detail-view/uploads-card";
import { buildUpdatesFeed } from "./activity-detail-view/feed";
import { formatDateRange, formatDuration } from "./activity-detail-view/format";
import type { ActivityDetailViewProps } from "./activity-detail-view/types";

// Re-export the public types so portal/workspace pages keep their existing
// import path. Sub-components consume them directly from ./types.
export type {
  ActivityForView,
  PhaseOption,
  ActivityDetailViewProps,
} from "./activity-detail-view/types";

/**
 * Top-level composer for an activity detail page. Was a 990-line single file;
 * the individual cards, helpers, and edit form now live next to each other
 * under `./activity-detail-view/` so they can be modified, memoized, or
 * unit-tested in isolation. This file only owns layout + the header strip.
 */
export function ActivityDetailView({
  activity,
  proofs,
  timeline,
  teamUsers,
  user,
  baseHref,
  backHref,
  backLabel,
  postUpdate,
  upload,
  isEditing = false,
  phases,
  save,
  markComplete,
  reopen,
  deleteAction,
  deleteRedirectTo,
  showNotes = true,
  showTimeline = true,
  showResponsible = true,
}: ActivityDetailViewProps) {
  const isDone = activity.status === "done";
  const phaseName = activity.phase?.name ?? "Phase";
  const projectName = activity.phase?.project?.name ?? "Project";
  const duration = formatDuration(activity.planned_date, activity.completed_date);
  const proofsById = new Map(proofs.map((p) => [p.id, p]));
  const updates = buildUpdatesFeed(timeline, proofsById);

  const canEdit = !!save && !!phases;
  const canMarkComplete = !!markComplete && !isDone;
  const canReopen = !!reopen && isDone;
  const canDelete = !!deleteAction;

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      {/* PAGE HEADER ------------------------------------------------- */}
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {backLabel}
          </Link>
          <h1 className="font-heading max-w-3xl text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-[28px]">
            {activity.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">{projectName}</span>
            <span className="mx-1.5 inline-block size-1 -translate-y-0.5 rounded-full bg-muted-foreground/40 align-middle" />
            {phaseName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            isEditing ? (
              <Button variant="outline" size="sm" render={<Link href={baseHref} />}>
                Cancel
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`${baseHref}?edit=1`} />}
              >
                <Pencil className="size-4" />
                Edit activity
              </Button>
            )
          )}
          {canMarkComplete ? (
            <form action={markComplete}>
              <Button type="submit" size="sm">
                <CircleCheck className="size-4" />
                Mark complete
              </Button>
            </form>
          ) : canReopen ? (
            <form action={reopen}>
              <Button type="submit" size="sm" variant="outline">
                <RotateCcw className="size-4" />
                Reopen
              </Button>
            </form>
          ) : null}
          {canDelete && (
            <DeleteConfirm
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/40"
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              }
              title="Delete activity"
              description={
                <>
                  Permanently delete <strong>{activity.name}</strong>? All
                  documents uploaded to it will be removed.
                </>
              }
              redirectTo={deleteRedirectTo}
              action={deleteAction!}
            />
          )}
        </div>
      </div>

      {/* STATUS STRIP ------------------------------------------------ */}
      <section className="mb-6 grid grid-cols-1 divide-y divide-border rounded-2xl border bg-card shadow-sm sm:grid-cols-3 sm:divide-y-0 sm:[&>*:not(:first-child)]:border-l">
        <StripCell label="Status">
          <ActivityStatus status={activity.status} />
        </StripCell>
        <StripCell label="Timeline">
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium leading-tight">
                {formatDateRange(activity.planned_date, activity.completed_date)}
              </p>
              {duration && (
                <p className="mt-0.5 text-xs text-muted-foreground">{duration}</p>
              )}
            </div>
          </div>
        </StripCell>
        <StripCell label="Team">
          {teamUsers.length > 0 ? (
            <div className="flex items-center -space-x-2">
              {teamUsers.slice(0, 3).map((u) => (
                <UserAvatar
                  key={u.email}
                  email={u.email}
                  name={u.name}
                  size="sm"
                  className="ring-2 ring-card"
                />
              ))}
              {teamUsers.length > 3 && (
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card">
                  +{teamUsers.length - 3}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No members yet</span>
          )}
        </StripCell>
      </section>

      {/* MAIN GRID --------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          {isEditing && canEdit ? (
            <EditCard
              save={save!}
              activity={activity}
              phases={phases!}
              baseHref={baseHref}
            />
          ) : (
            <>
              <DetailsCard activity={activity} showResponsible={showResponsible} />
              {showNotes && <NotesCard description={activity.description} />}
              <UpdatesCard
                updates={updates}
                composer={
                  postUpdate ? (
                    <UpdateComposer
                      action={postUpdate}
                      upload={upload}
                      user={user}
                    />
                  ) : null
                }
              />
            </>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          {showTimeline && (
            <TimelineCard events={timeline} status={activity.status} />
          )}
          <UploadsCard proofs={proofs} />
        </aside>
      </div>
    </div>
  );
}
