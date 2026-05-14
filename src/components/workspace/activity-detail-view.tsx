import {
  ArrowLeft,
  CalendarDays,
  CircleCheck,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Image as ImageIcon,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToastForm, type ToastFormResult } from "@/components/ui/toast-form";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { DeleteConfirm } from "@/components/workspace/delete-confirm";
import { ProofAccessButton } from "@/components/workspace/proof-access-button";
import { UpdateComposer } from "@/components/workspace/update-composer";
import type {
  ActivityTimelineEvent,
  WorkspaceProof,
} from "@/lib/workspace/queries";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────
 *  Activity input shape — matches what `getActivity` returns. We accept a
 *  loose shape so the same component can render data fetched by either
 *  the workspace or portal pages without duplicating the type.
 * ──────────────────────────────────────────────────────────────────── */
export type ActivityForView = {
  id: string;
  phase_id: string;
  name: string;
  description: string | null;
  deliverable: string | null;
  responsible: string | null;
  planned_date: string | null;
  completed_date: string | null;
  narrative_note: string | null;
  status: "not_started" | "in_progress" | "done";
  phase: {
    id: string;
    name: string;
    project: { id: string; name: string } | null;
  } | null;
};

export type PhaseOption = { id: string; name: string };

type Props = {
  activity: ActivityForView;
  proofs: WorkspaceProof[];
  timeline: ActivityTimelineEvent[];
  teamUsers: { name: string; email: string }[];
  user: { name: string; email: string; avatarUrl: string | null };
  baseHref: string;
  backHref: string;
  backLabel: string;
  /**
   * Required for posting messages from the chat-style composer. If omitted
   * the composer is hidden (read-only view).
   */
  postUpdate?: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
  /** Required for the paperclip in the composer to actually upload. */
  upload?: (formData: FormData) => void | Promise<void>;

  // Edit mode (workspace only). Omit any of these to hide the action.
  isEditing?: boolean;
  phases?: PhaseOption[];
  save?: (formData: FormData) => Promise<ToastFormResult | void>;
  markComplete?: () => void | Promise<void>;
  deleteAction?: () => Promise<{ ok: boolean; error?: string }>;
  deleteRedirectTo?: string;

  // Visibility toggles for sections that don't apply to every audience.
  showNotes?: boolean;
  showTimeline?: boolean;
  /**
   * Whether to surface the per-activity "Responsible team" assignment.
   * Defaults to true (workspace/admin). The client portal passes false
   * because internal task assignment is a DC&A delivery detail, not
   * something the client should see.
   */
  showResponsible?: boolean;
};

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
  deleteAction,
  deleteRedirectTo,
  showNotes = true,
  showTimeline = true,
  showResponsible = true,
}: Props) {
  const isDone = activity.status === "done";
  const phaseName = activity.phase?.name ?? "Phase";
  const projectName = activity.phase?.project?.name ?? "Project";
  const progress = computeProgress(activity.status, timeline);
  const duration = formatDuration(activity.planned_date, activity.completed_date);
  const lastEvent = timeline[timeline.length - 1];
  const proofsById = new Map(proofs.map((p) => [p.id, p]));
  const updates = buildUpdatesFeed(timeline, proofsById);

  const canEdit = !!save && !!phases;
  const canMarkComplete = !!markComplete && !isDone;
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
          ) : isDone ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700">
              <CircleCheck className="size-3.5" />
              Completed
            </span>
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
      <section className="mb-6 grid divide-y divide-border rounded-2xl border bg-card shadow-sm sm:grid-cols-2 sm:divide-y-0 sm:[&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(even)]:border-l sm:divide-border lg:grid-cols-5 lg:[&>*]:border-t-0 lg:[&>*:not(:first-child)]:border-l">
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
        <StripCell label="Progress">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold tabular-nums">{progress}%</span>
            <div className="h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
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
        <StripCell label="Last update">
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium leading-tight">
                {lastEvent ? formatRelative(lastEvent.created_at) : "No activity yet"}
              </p>
              {lastEvent?.actor_name && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  by {lastEvent.actor_name}
                </p>
              )}
            </div>
          </div>
        </StripCell>
      </section>

      {/* MAIN GRID --------------------------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
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

/* ──────────────────────────────────────────────────────────────────────
 *  Local presentational pieces
 * ──────────────────────────────────────────────────────────────────── */
function StripCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Card({
  icon,
  title,
  action,
  children,
  bodyClassName,
}: {
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <h2 className="font-heading truncate text-sm font-semibold tracking-tight">
            {title}
          </h2>
        </div>
        {action}
      </header>
      <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}

function DetailsCard({
  activity,
  showResponsible,
}: {
  activity: { deliverable: string | null; responsible: string | null };
  showResponsible: boolean;
}) {
  return (
    <Card icon={<FileText className="size-4" />} title="Activity details">
      <dl
        className={cn(
          "-mx-5 -my-4 grid divide-y divide-border sm:divide-y-0",
          showResponsible && "sm:grid-cols-2 sm:divide-x",
        )}
      >
        <Field label="Deliverable">
          {activity.deliverable ?? <Muted text="Not specified" />}
        </Field>
        {showResponsible && (
          <Field label="Responsible team">
            {activity.responsible ?? <Muted text="Not assigned" />}
          </Field>
        )}
      </dl>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function NotesCard({ description }: { description: string | null }) {
  return (
    <Card icon={<GitBranch className="size-4" />} title="Notes">
      {description ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">{description}</p>
      ) : (
        <Muted text="No notes yet." />
      )}
    </Card>
  );
}

type FeedItem = {
  id: string;
  actor: string;
  email: string;
  timestamp: string;
  body: string;
  attachments: WorkspaceProof[];
};

function UpdatesCard({
  updates,
  composer,
}: {
  updates: FeedItem[];
  composer: React.ReactNode;
}) {
  return (
    <Card icon={<MessageSquare className="size-4" />} title="Updates">
      {updates.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/30 p-5 text-center text-sm text-muted-foreground">
          No updates yet. Share progress with the team below.
        </p>
      ) : (
        <ul className="space-y-5">
          {updates.map((u, i) => (
            <li key={u.id} className="flex gap-3">
              <UserAvatar email={u.email} name={u.actor} size="md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-foreground">
                    {u.actor}
                  </span>
                  {i === 0 && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Latest
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{u.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {u.body}
                </p>
                {u.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {u.attachments.map((p) => (
                      <AttachmentChip key={p.id} proof={p} />
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {composer && <div className="mt-5">{composer}</div>}
    </Card>
  );
}

function AttachmentChip({ proof }: { proof: WorkspaceProof }) {
  const meta = fileVisuals(proof);
  return (
    <ProofAccessButton
      proofId={proof.id}
      fileName={proof.file_name}
      caption={proof.caption}
      kind={proof.kind}
      hint={proof.kind === "link" ? proof.url : proof.mime_type}
      trigger={
        <button
          type="button"
          className="inline-flex max-w-full items-center gap-2 rounded-lg border bg-background py-1.5 pl-1.5 pr-3 text-left text-xs transition-colors hover:bg-muted"
        >
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-bold uppercase text-white",
              meta.bg,
            )}
          >
            {meta.label}
          </span>
          <span className="truncate font-medium">{proof.file_name}</span>
          {proof.size_bytes && (
            <span className="shrink-0 text-muted-foreground">
              {formatBytes(proof.size_bytes)}
            </span>
          )}
        </button>
      }
    />
  );
}

function TimelineCard({
  events,
  status,
}: {
  events: ActivityTimelineEvent[];
  status: "not_started" | "in_progress" | "done";
}) {
  const steps = buildLifecycle(events, status);
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <header className="px-5 pt-4 pb-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Timeline</h2>
      </header>
      <div className="px-5 pb-5">
        <ol className="relative space-y-4">
          <span
            aria-hidden
            className="absolute left-[9px] top-2 bottom-2 w-px bg-border"
          />
          {steps.map((step) => (
            <li key={step.key} className="relative flex gap-3 pl-0">
              <span
                className={cn(
                  "relative z-10 mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full ring-2 ring-card",
                  step.state === "done" && "bg-emerald-500 text-white",
                  step.state === "current" && "bg-primary text-white",
                  step.state === "future" &&
                    "border border-dashed border-muted-foreground/40 bg-card",
                )}
              >
                {step.state === "done" && <CircleCheck className="size-3" />}
                {step.state === "current" && (
                  <span className="size-1.5 rounded-full bg-white" />
                )}
              </span>
              <div className="min-w-0 flex-1 pb-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={cn(
                      "truncate text-sm",
                      step.state === "future"
                        ? "text-muted-foreground"
                        : "font-medium text-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="shrink-0 text-[11px] text-muted-foreground">
                    {step.when ? formatDateTime(step.when) : "—"}
                  </p>
                </div>
                {step.actor && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    by {step.actor}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function UploadsCard({ proofs }: { proofs: WorkspaceProof[] }) {
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Uploads</h2>
        <span className="text-[11px] text-muted-foreground">
          {proofs.length} {proofs.length === 1 ? "item" : "items"}
        </span>
      </header>
      <div className="px-5 py-4">
        {proofs.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/30 p-5 text-center text-xs text-muted-foreground">
            No uploads yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {proofs.map((proof) => (
              <li key={proof.id}>
                <FileRow proof={proof} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function FileRow({ proof }: { proof: WorkspaceProof }) {
  const meta = fileVisuals(proof);
  return (
    <ProofAccessButton
      proofId={proof.id}
      fileName={proof.file_name}
      caption={proof.caption}
      kind={proof.kind}
      hint={proof.kind === "link" ? proof.url : proof.mime_type}
      trigger={
        <button
          type="button"
          className="group/file flex w-full items-center gap-3 rounded-xl border bg-background p-2.5 text-left transition-colors hover:bg-muted/40"
        >
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg text-white",
              meta.bg,
            )}
          >
            {meta.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {proof.file_name}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              Uploaded {formatShortDate(proof.created_at)}
              {proof.caption ? ` · ${proof.caption}` : ""}
            </span>
          </span>
          <span className="ml-2 flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
            {proof.size_bytes ? formatBytes(proof.size_bytes) : null}
            <MoreHorizontal className="size-4 text-muted-foreground opacity-60 group-hover/file:opacity-100" />
          </span>
        </button>
      }
    />
  );
}

function EditCard({
  save,
  activity,
  phases,
  baseHref,
}: {
  save: (fd: FormData) => Promise<ToastFormResult | void>;
  activity: ActivityForView;
  phases: PhaseOption[];
  baseHref: string;
}) {
  return (
    <Card icon={<Pencil className="size-4" />} title="Edit activity">
      <ToastForm
        action={save}
        successMessage="Activity saved"
        className="space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Phase
            <select
              name="phase_id"
              defaultValue={activity.phase_id}
              required
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            >
              {phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Status
            <select
              name="status"
              defaultValue={activity.status}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">Ongoing</option>
              <option value="done">Done</option>
            </select>
          </label>
        </div>
        <label className="grid gap-2 text-sm font-medium">
          Activity name
          <Input name="name" defaultValue={activity.name} required />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Deliverable
          <Input
            name="deliverable"
            placeholder="What concrete output proves this activity is done?"
            defaultValue={activity.deliverable ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Responsible team
          <Input
            name="responsible"
            placeholder="Team member, team, or external partner"
            defaultValue={activity.responsible ?? ""}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Start date
            <Input
              name="planned_date"
              type="date"
              defaultValue={activity.planned_date ?? ""}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            End date
            <Input
              name="completed_date"
              type="date"
              defaultValue={activity.completed_date ?? ""}
            />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-medium">
          Notes / dependencies
          <Textarea
            name="description"
            defaultValue={activity.description ?? ""}
            placeholder="Anything the team needs to know — prerequisites, references, links."
            rows={4}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Completion narrative
          <Textarea
            name="narrative_note"
            defaultValue={activity.narrative_note ?? ""}
            placeholder="Shown to the client in the portal once the activity is marked done."
            rows={5}
          />
        </label>
        <div className="flex items-center gap-2">
          <Button type="submit">Save activity</Button>
          <Button variant="outline" render={<Link href={baseHref} />}>
            Cancel
          </Button>
        </div>
      </ToastForm>
    </Card>
  );
}

function Muted({ text }: { text: string }) {
  return <span className="text-sm italic text-muted-foreground">{text}</span>;
}

/* ──────────────────────────────────────────────────────────────────────
 *  Pure helpers
 * ──────────────────────────────────────────────────────────────────── */
function computeProgress(
  status: "not_started" | "in_progress" | "done",
  events: ActivityTimelineEvent[],
): number {
  if (status === "done") return 100;
  if (status === "not_started") return 0;
  let score = 25;
  if (events.some((e) => e.action === "created")) score += 15;
  if (events.some((e) => e.action === "proof_added")) score += 32;
  if (events.some((e) => e.action === "updated")) score = Math.min(score + 10, 95);
  return Math.min(score, 95);
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return "Not scheduled";
  const fmt = (s: string | null) =>
    s
      ? new Date(s).toLocaleDateString(undefined, {
          month: "short",
          day: "2-digit",
        })
      : "—";
  const year = new Date(end ?? start ?? Date.now()).getFullYear();
  return `${fmt(start)} – ${fmt(end)}, ${year}`;
}

function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  const diff = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
  if (diff === 0) return "Same day";
  return `${diff} day${diff === 1 ? "" : "s"}`;
}

function formatRelative(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileVisuals(proof: WorkspaceProof): {
  bg: string;
  label: string;
  icon: React.ReactNode;
} {
  if (proof.kind === "link") {
    return {
      bg: "bg-sky-500",
      label: "URL",
      icon: <ExternalLink className="size-4" />,
    };
  }
  const name = proof.file_name.toLowerCase();
  const mime = proof.mime_type ?? "";
  if (name.endsWith(".pdf") || mime.includes("pdf")) {
    return { bg: "bg-red-500", label: "PDF", icon: <FileText className="size-4" /> };
  }
  if (name.endsWith(".doc") || name.endsWith(".docx") || mime.includes("word")) {
    return { bg: "bg-blue-500", label: "DOC", icon: <FileText className="size-4" /> };
  }
  if (
    name.endsWith(".xls") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".csv") ||
    mime.includes("sheet")
  ) {
    return {
      bg: "bg-emerald-500",
      label: "XLS",
      icon: <FileSpreadsheet className="size-4" />,
    };
  }
  if (
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".gif") ||
    name.endsWith(".webp") ||
    mime.startsWith("image/")
  ) {
    return {
      bg: "bg-violet-500",
      label: "IMG",
      icon: <ImageIcon className="size-4" />,
    };
  }
  return {
    bg: "bg-slate-500",
    label: "FILE",
    icon: <FileText className="size-4" />,
  };
}

function buildUpdatesFeed(
  events: ActivityTimelineEvent[],
  proofsById: Map<string, WorkspaceProof>,
): FeedItem[] {
  const items: FeedItem[] = [];
  const ordered = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  for (const event of ordered) {
    const actor = event.actor_name ?? "Team member";
    const email = `${actor.toLowerCase().replace(/\s+/g, ".")}@team`;
    const meta = event.meta as { note?: string; proof_id?: string; count?: number };

    if (event.action === "updated" && meta.note) {
      items.push({
        id: event.id,
        actor,
        email,
        timestamp: formatTimestamp(event.created_at),
        body: meta.note,
        attachments: [],
      });
    } else if (event.action === "proof_added") {
      const proofId = meta.proof_id;
      const attached = proofId
        ? [proofsById.get(proofId)].filter((p): p is WorkspaceProof => !!p)
        : [];
      items.push({
        id: event.id,
        actor,
        email,
        timestamp: formatTimestamp(event.created_at),
        body: `Uploaded ${meta.count ?? 1} document${(meta.count ?? 1) === 1 ? "" : "s"} to this activity.`,
        attachments: attached,
      });
    } else if (event.action === "marked_done") {
      items.push({
        id: event.id,
        actor,
        email,
        timestamp: formatTimestamp(event.created_at),
        body: "Marked this activity as complete.",
        attachments: [],
      });
    }
  }

  return items;
}

type LifecycleStep = {
  key: string;
  label: string;
  state: "done" | "current" | "future";
  when: string | null;
  actor: string | null;
};

function buildLifecycle(
  events: ActivityTimelineEvent[],
  status: "not_started" | "in_progress" | "done",
): LifecycleStep[] {
  const find = (actions: string[]) =>
    events.find((e) => actions.includes(e.action));
  const created = find(["created"]);
  const assigned = find(["assigned", "updated"]);
  const started = find(["started"]);
  const proof = find(["proof_added"]);
  const done = find(["marked_done"]);

  const currentKey =
    status === "done"
      ? "completed"
      : proof
        ? "proof"
        : started
          ? "started"
          : assigned
            ? "assigned"
            : created
              ? "created"
              : "created";

  function step(
    key: string,
    label: string,
    src: ActivityTimelineEvent | undefined,
    fallbackState: "done" | "current" | "future",
  ): LifecycleStep {
    const state: "done" | "current" | "future" = src
      ? key === currentKey
        ? "current"
        : "done"
      : fallbackState;
    return {
      key,
      label,
      state,
      when: src?.created_at ?? null,
      actor: src?.actor_name ?? null,
    };
  }

  return [
    step("created", "Activity created", created, "future"),
    step("assigned", "Assigned to team", assigned, "future"),
    step(
      "started",
      "Started",
      started,
      currentKey === "started" ? "current" : "future",
    ),
    step(
      "proof",
      "Document uploaded",
      proof,
      currentKey === "proof" ? "current" : "future",
    ),
    step(
      "completed",
      "Completed",
      done,
      currentKey === "completed" ? "current" : "future",
    ),
  ];
}
