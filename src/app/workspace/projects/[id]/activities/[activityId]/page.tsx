import {
  CalendarDays,
  CircleCheck,
  FileText,
  Link2,
  Pencil,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { ActivityTimeline } from "@/components/workspace/activity-timeline";
import { DeleteConfirm } from "@/components/workspace/delete-confirm";
import { ProofAccessButton } from "@/components/workspace/proof-access-button";
import { ProofComments } from "@/components/proofs/proof-comments";
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
} from "@/lib/workspace/queries";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

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

  const [profile, activity, phases, proofs, timeline] = await Promise.all([
    getCurrentProfile(),
    getActivity(activityId),
    listProjectPhases(id),
    listActivityProofs(activityId),
    listActivityTimeline(activityId),
  ]);
  if (!profile) notFound();

  const baseHref = `/workspace/projects/${id}/activities/${activityId}`;
  const isDone = activity.status === "done";

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

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title={activity.name}
        subtitle={`${activity.phase?.project?.name ?? "Project"} · ${activity.phase?.name ?? "Phase"}`}
        backFallbackHref={`/workspace/projects/${id}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isEditing ? (
              <Button variant="outline" size="sm" render={<Link href={baseHref} />}>
                Cancel
              </Button>
            ) : (
              <Button variant="outline" size="sm" render={<Link href={`${baseHref}?edit=1`} />}>
                <Pencil className="size-4" />
                Edit
              </Button>
            )}
            {!isDone && (
              <form action={markComplete}>
                <Button type="submit" size="sm">
                  <CircleCheck className="size-4" />
                  Mark complete
                </Button>
              </form>
            )}
            <DeleteConfirm
              trigger={
                <Button variant="destructive" size="sm">
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              }
              title="Delete activity"
              description={
                <>
                  Permanently delete <strong>{activity.name}</strong>? All proofs uploaded to it will be removed.
                </>
              }
              redirectTo={`/workspace/projects/${id}`}
              action={async () => {
                "use server";
                return deleteActivity(activityId);
              }}
            />
          </div>
        }
      />

      {/* Status / dates / responsible strip — gives the team the at-a-glance
          context the mockup leads with, without crowding the page header. */}
      <div className="mb-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetaCell label="Status">
          <ActivityStatus status={activity.status} />
        </MetaCell>
        <MetaCell label="Start date">
          <span className="inline-flex items-center gap-1.5 text-sm">
            <CalendarDays className="size-4 text-muted-foreground" />
            {activity.planned_date ?? "Not scheduled"}
          </span>
        </MetaCell>
        <MetaCell label="End date">
          <span className="inline-flex items-center gap-1.5 text-sm">
            <CalendarDays className="size-4 text-muted-foreground" />
            {activity.completed_date ?? "—"}
          </span>
        </MetaCell>
        <MetaCell label="Responsible team">
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Users className="size-4 text-muted-foreground" />
            <span className="truncate">{activity.responsible ?? "Not assigned"}</span>
          </span>
        </MetaCell>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {isEditing ? (
          <SectionCard
            title="Edit activity"
            description="Update planning details, completion notes, and status."
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
          </SectionCard>
        ) : (
          <SectionCard
            title="Activity details"
            description="Click Edit to change any of these values."
          >
            <dl className="grid gap-5 sm:grid-cols-2">
              <DetailField label="Deliverable">
                {activity.deliverable ?? <Muted text="Not specified yet" />}
              </DetailField>
              <DetailField label="Responsible team">
                {activity.responsible ?? <Muted text="Not assigned" />}
              </DetailField>
              <DetailField label="Notes / dependencies" className="sm:col-span-2">
                {activity.description ? (
                  <p className="whitespace-pre-wrap text-sm">{activity.description}</p>
                ) : (
                  <Muted text="No notes yet." />
                )}
              </DetailField>
              <DetailField label="Completion narrative" className="sm:col-span-2">
                {activity.narrative_note ? (
                  <p className="whitespace-pre-wrap text-sm">{activity.narrative_note}</p>
                ) : (
                  <Muted text="Will appear in the client portal once added." />
                )}
              </DetailField>
            </dl>
          </SectionCard>
        )}

        <aside className="space-y-4">
          <SectionCard title="Timeline" description="Lifecycle of this activity.">
            <ActivityTimeline events={timeline} />
          </SectionCard>

          <SectionCard title="Proofs" description={`${proofs.length} attached`}>
            {proofs.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No proofs yet"
                description="Upload files or add links to share evidence of completion."
              />
            ) : (
              <div className="space-y-4">
                {proofs.map((proof) => (
                  <div key={proof.id} className="space-y-2">
                    <ProofAccessButton
                      proofId={proof.id}
                      fileName={proof.file_name}
                      caption={proof.caption}
                      kind={proof.kind}
                      hint={proof.kind === "link" ? proof.url : proof.mime_type}
                    />
                    <ProofComments
                      proofId={proof.id}
                      currentUserId={profile.userId}
                      isAdmin={profile.role === "admin"}
                    />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Upload files"
            description="Photos, PDFs, documents, or any other proof file."
          >
            <form action={upload} className="space-y-3">
              <Input name="proofs" type="file" multiple required />
              <Textarea name="caption" placeholder="Optional caption" rows={3} />
              <Button type="submit" className="w-full">
                <Upload className="size-4" />
                Upload proofs
              </Button>
            </form>
          </SectionCard>

          <SectionCard
            title="Add link"
            description="Share an external link as proof (Drive, Notion, video, etc.)."
          >
            <form action={addLink} className="space-y-3">
              <Input name="url" type="url" placeholder="https://…" required />
              <Input name="file_name" placeholder="Display name (optional)" />
              <Textarea name="caption" placeholder="Optional caption" rows={2} />
              <Button type="submit" variant="outline" className="w-full">
                <Link2 className="size-4" />
                Save link
              </Button>
            </form>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm">{children}</dd>
    </div>
  );
}

function Muted({ text }: { text: string }) {
  return <span className="text-sm italic text-muted-foreground">{text}</span>;
}
