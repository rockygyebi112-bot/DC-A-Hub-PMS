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
  Link2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { DeleteConfirm } from "@/components/workspace/delete-confirm";
import { ProofAccessButton } from "@/components/workspace/proof-access-button";
import { UpdateComposer } from "@/components/workspace/update-composer";
import { ProofUploadZone } from "@/components/workspace/proof-upload-zone";
import {
  addProofLink,
  deleteActivity,
  updateActivity,
  uploadProofs,
} from "@/lib/workspace/actions";
import {
  getActivity,
  listActivityProofs,
  listActivityTimeline,
  listProjectPhases,
  listProjectTeam,
  type ActivityTimelineEvent,
  type WorkspaceProof,
} from "@/lib/workspace/queries";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { requireProjectWriter } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import { cn } from "@/lib/utils";

export default async function WorkspaceActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; activityId: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id, activityId } = await params;
  const sp = await searchParams;
  // Edit mode is URL-driven (?edit=1) so links are bookmarkable and the
  // page can stay a server component — no client-side state needed.
  const isEditing = sp.edit === "1";

  const [profile, activity, phases, proofs, timeline, team] = await Promise.all([
    getCurrentProfile(),
    getActivity(activityId),
    listProjectPhases(id),
    listActivityProofs(activityId),
    listActivityTimeline(activityId),
    listProjectTeam(id),
  ]);
  if (!profile) notFound();

  const baseHref = `/workspace/projects/${id}/activities/${activityId}`;
  const projectHref = `/workspace/projects/${id}`;
  const isDone = activity.status === "done";

  // Phase index gives the title subtitle a stable "1. Phase Name" prefix.
  const phaseIdx = phases.findIndex((p) => p.id === activity.phase_id);
  const phaseLabel =
    phaseIdx >= 0 && activity.phase
      ? `${phaseIdx + 1}. ${activity.phase.name}`
      : activity.phase?.name ?? "Phase";

  const teamUsers = team
    .map((m) => m.profile)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ name: p.full_name, email: p.email }));

  const progress = computeProgress(activity.status, timeline);
  const duration = formatDuration(activity.planned_date, activity.completed_date);
  const lastEvent = timeline[timeline.length - 1];

  async function save(formData: FormData) {
    "use server";
    await updateActivity(activityId, formData);
  }

  async function upload(formData: FormData) {
    "use server";
    await uploadProofs(activityId, formData);
  }

  async function addLink(formData: FormData) {
    "use server";
    await addProofLink(activityId, formData);
  }

  // Mark-complete reuses `updateActivity` so we keep the existing
  // notification/logging side-effects intact instead of writing to the row
  // directly.
  async function markComplete() {
    "use server";
    const fd = new FormData();
    fd.set("phase_id", activity.phase_id);
    fd.set("name", activity.name);
    fd.set("status", "done");
    fd.set("deliverable", activity.deliverable ?? "");
    fd.set("responsible", activity.responsible ?? "");
    fd.set("planned_date", activity.planned_date ?? "");
    fd.set("completed_date", activity.completed_date ?? "");
    fd.set("description", activity.description ?? "");
    fd.set("narrative_note", activity.narrative_note ?? "");
    await updateActivity(activityId, fd);
  }

  // Free-text update posted from the composer. We persist as an
  // `activity_log` row with action="updated" + meta.note so it shows up in
  // both the Updates feed and the lifecycle Timeline without needing a new
  // table. The `updateActivity` action already writes "updated" log rows
  // — this is the cheaper, comment-only variant.
  async function postUpdate(formData: FormData) {
    "use server";
    const note = String(formData.get("note") ?? "").trim();
    if (!note) return { ok: false, error: "Write something first." };

    const sb = await createClient();
    const { data: row } = await sb
      .from("activities")
      .select("phase:phases(project_id)")
      .eq("id", activityId)
      .single();
    const phase = Array.isArray(row?.phase) ? row?.phase[0] : row?.phase;
    const projectId = phase?.project_id;
    if (!projectId) return { ok: false, error: "Project not found" };

    const auth = await requireProjectWriter(projectId);
    if (!auth.ok) return auth;

    const { error } = await sb.from("activity_log").insert({
      project_id: projectId,
      activity_id: activityId,
      actor_user_id: profile!.userId,
      action: "updated",
      meta: { note },
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath(baseHref);
    return { ok: true };
  }

  const proofsById = new Map(proofs.map((p) => [p.id, p]));
  const updates = buildUpdatesFeed(timeline, proofsById);

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      {/* PAGE HEADER ------------------------------------------------- */}
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <Link
            href={projectHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to workplan
          </Link>
          <h1 className="font-heading max-w-3xl text-balance text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-[28px]">
            {activity.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">
              {activity.phase?.project?.name ?? "Project"}
            </span>
            <span className="mx-1.5 inline-block size-1 -translate-y-0.5 rounded-full bg-muted-foreground/40 align-middle" />
            {phaseLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isEditing ? (
            <Button variant="outline" size="sm" render={<Link href={baseHref} />}>
              Cancel
            </Button>
          ) : (
            <Button variant="outline" size="sm" render={<Link href={`${baseHref}?edit=1`} />}>
              <Pencil className="size-4" />
              Edit activity
            </Button>
          )}
          {!isDone ? (
            <form action={markComplete}>
              <Button type="submit" size="sm">
                <CircleCheck className="size-4" />
                Mark complete
              </Button>
            </form>
          ) : (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700">
              <CircleCheck className="size-3.5" />
              Completed
            </span>
          )}
          <DeleteConfirm
            trigger={
              <Button variant="outline" size="icon-sm" aria-label="More actions">
                <MoreHorizontal className="size-4" />
              </Button>
            }
            title="Delete activity"
            description={
              <>
                Permanently delete <strong>{activity.name}</strong>? All proofs
                uploaded to it will be removed.
              </>
            }
            redirectTo={projectHref}
            action={async () => {
              "use server";
              return deleteActivity(activityId);
            }}
          />
        </div>
      </div>

      {/* STATUS STRIP ------------------------------------------------ */}
      <section className="mb-6 grid gap-5 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
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
          {isEditing ? (
            <EditCard
              save={save}
              activity={activity}
              phases={phases}
              baseHref={baseHref}
            />
          ) : (
            <>
              <DetailsCard activity={activity} />
              <DependenciesCard description={activity.description} />
              <UpdatesCard
                updates={updates}
                composer={
                  <UpdateComposer
                    action={postUpdate}
                    user={{
                      name: profile.fullName,
                      email: profile.email,
                      avatarUrl: profile.avatarUrl,
                    }}
                  />
                }
              />
            </>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <TimelineCard events={timeline} status={activity.status} />
          <EvidenceCard
            proofs={proofs}
            upload={upload}
            addLink={addLink}
            isAdmin={profile.role === "admin"}
            currentUserId={profile.userId}
          />
        </aside>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   STATUS STRIP CELL
   ──────────────────────────────────────────────────────────────────── */
function StripCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   GENERIC CARD WRAPPER
   ──────────────────────────────────────────────────────────────────── */
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
          {icon && (
            <span className="text-muted-foreground">{icon}</span>
          )}
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

/* ──────────────────────────────────────────────────────────────────────
   ACTIVITY DETAILS
   ──────────────────────────────────────────────────────────────────── */
function DetailsCard({
  activity,
}: {
  activity: { deliverable: string | null; responsible: string | null };
}) {
  return (
    <Card
      icon={<FileText className="size-4" />}
      title="Activity details"
    >
      <dl className="grid gap-6 sm:grid-cols-2">
        <Field label="Deliverable">
          {activity.deliverable ?? <Muted text="Not specified" />}
        </Field>
        <Field label="Responsible team">
          {activity.responsible ?? <Muted text="Not assigned" />}
        </Field>
      </dl>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   DEPENDENCIES
   ──────────────────────────────────────────────────────────────────── */
function DependenciesCard({
  description,
}: {
  description: string | null;
}) {
  return (
    <Card
      icon={<GitBranch className="size-4" />}
      title="Dependencies"
    >
      {description ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">{description}</p>
      ) : (
        <Muted text="No dependencies recorded." />
      )}
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   UPDATES FEED
   ──────────────────────────────────────────────────────────────────── */
type FeedItem = {
  id: string;
  actor: string;
  email: string;
  timestamp: string;
  body: string;
  badge?: "latest";
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
    <Card
      icon={<MessageSquare className="size-4" />}
      title="Updates"
    >
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
                  <span className="text-xs text-muted-foreground">
                    {u.timestamp}
                  </span>
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
      <div className="mt-5">{composer}</div>
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

/* ──────────────────────────────────────────────────────────────────────
   RIGHT: TIMELINE
   ──────────────────────────────────────────────────────────────────── */
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
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Timeline
        </h2>
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
                  step.state === "done" &&
                    "bg-emerald-500 text-white",
                  step.state === "current" &&
                    "bg-primary text-white",
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

/* ──────────────────────────────────────────────────────────────────────
   RIGHT: EVIDENCE & PROOFS
   ──────────────────────────────────────────────────────────────────── */
function EvidenceCard({
  proofs,
  upload,
  addLink,
}: {
  proofs: WorkspaceProof[];
  upload: (fd: FormData) => void | Promise<void>;
  addLink: (fd: FormData) => void | Promise<void>;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const files = proofs.filter((p) => p.kind === "file");
  const links = proofs.filter((p) => p.kind === "link");
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Evidence &amp; proofs
        </h2>
      </header>
      <div className="px-5 py-4">
        {/* Tabs row */}
        <div className="flex items-center gap-4 border-b text-xs font-medium">
          <span className="relative -mb-px border-b-2 border-primary pb-2 text-primary">
            Files
            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              {files.length}
            </span>
          </span>
          <span className="relative -mb-px pb-2 text-muted-foreground">
            Links
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
              {links.length}
            </span>
          </span>
        </div>

        <ProofUploadZone action={upload} />

        {/* Files list */}
        {files.length > 0 && (
          <ul className="mt-4 space-y-2">
            {files.map((proof) => (
              <li key={proof.id}>
                <FileRow proof={proof} />
              </li>
            ))}
          </ul>
        )}

        {/* Add link inline form (kept for parity with previous UX) */}
        <details className="mt-4 group">
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            <Link2 className="size-3.5" />
            Add an external link instead
          </summary>
          <form action={addLink} className="mt-3 space-y-2">
            <Input name="url" type="url" placeholder="https://…" required />
            <Input name="file_name" placeholder="Display name (optional)" />
            <Textarea name="caption" placeholder="Optional caption" rows={2} />
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Save link
            </Button>
          </form>
        </details>

        {links.length > 0 && (
          <ul className="mt-4 space-y-2">
            {links.map((proof) => (
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

/* ──────────────────────────────────────────────────────────────────────
   EDIT FORM (kept from previous design — opens via ?edit=1)
   ──────────────────────────────────────────────────────────────────── */
function EditCard({
  save,
  activity,
  phases,
  baseHref,
}: {
  save: (fd: FormData) => Promise<void>;
  activity: Awaited<ReturnType<typeof getActivity>>;
  phases: Awaited<ReturnType<typeof listProjectPhases>>;
  baseHref: string;
}) {
  return (
    <Card
      icon={<Pencil className="size-4" />}
      title="Edit activity"
    >
      <form action={save} className="space-y-4">
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
      </form>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   PRESENTATIONAL HELPERS
   ──────────────────────────────────────────────────────────────────── */
function Muted({ text }: { text: string }) {
  return <span className="text-sm italic text-muted-foreground">{text}</span>;
}

/* ──────────────────────────────────────────────────────────────────────
   PURE HELPERS
   ──────────────────────────────────────────────────────────────────── */

function computeProgress(
  status: "not_started" | "in_progress" | "done",
  events: ActivityTimelineEvent[],
): number {
  if (status === "done") return 100;
  if (status === "not_started") return 0;
  // For in-progress activities derive a soft percentage from lifecycle
  // markers so the bar feels alive without requiring extra data.
  let score = 25; // started
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
  if (
    name.endsWith(".doc") ||
    name.endsWith(".docx") ||
    mime.includes("word")
  ) {
    return {
      bg: "bg-blue-500",
      label: "DOC",
      icon: <FileText className="size-4" />,
    };
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

/* Map raw activity_log rows into chat-style "Updates" posts. We prefer
   rows with a free-text note (action="updated" + meta.note) but also
   surface proof uploads and completion events so the feed feels live. */
function buildUpdatesFeed(
  events: ActivityTimelineEvent[],
  proofsById: Map<string, WorkspaceProof>,
): FeedItem[] {
  const items: FeedItem[] = [];
  // Iterate newest -> oldest so the rendered list reads from top to bottom.
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
        body: `Uploaded ${meta.count ?? 1} proof${(meta.count ?? 1) === 1 ? "" : "s"} to this activity.`,
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
  const assigned = find(["assigned", "updated"]); // best-effort proxy
  const started = find(["started"]);
  const proof = find(["proof_added"]);
  const done = find(["marked_done"]);

  const step = (
    key: string,
    label: string,
    event: ActivityTimelineEvent | undefined,
    fallbackState: "current" | "future",
  ): LifecycleStep => ({
    key,
    label,
    state: event ? "done" : fallbackState,
    when: event?.created_at ?? null,
    actor: event?.actor_name ?? null,
  });

  // Determine which step is "current" based on overall status.
  const currentKey =
    status === "done"
      ? null
      : status === "in_progress"
        ? proof
          ? "completed"
          : "proof"
        : "started";

  const steps: LifecycleStep[] = [
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
      "Proof uploaded",
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

  return steps;
}
