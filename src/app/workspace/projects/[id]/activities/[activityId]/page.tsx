import { FileText, Link2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { DeleteConfirm } from "@/components/workspace/delete-confirm";
import { ProofAccessButton } from "@/components/workspace/proof-access-button";
import {
  addProofLink,
  deleteActivity,
  updateActivity,
  uploadProofs,
} from "@/lib/workspace/actions";
import {
  getActivity,
  listActivityProofs,
  listProjectPhases,
} from "@/lib/workspace/queries";

export default async function WorkspaceActivityPage({
  params,
}: {
  params: Promise<{ id: string; activityId: string }>;
}) {
  const { id, activityId } = await params;
  const [activity, phases, proofs] = await Promise.all([
    getActivity(activityId),
    listProjectPhases(id),
    listActivityProofs(activityId),
  ]);

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

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title={activity.name}
        subtitle={`${activity.phase?.project?.name ?? "Project"} · ${activity.phase?.name ?? "Phase"}`}
        backFallbackHref={`/workspace/projects/${id}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ActivityStatus status={activity.status} />
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

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <SectionCard
          title="Activity"
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
            <Input name="name" defaultValue={activity.name} required />
            <Input
              name="responsible"
              placeholder="Responsible team member or team"
              defaultValue={activity.responsible ?? ""}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="planned_date" type="date" defaultValue={activity.planned_date ?? ""} />
              <Input name="completed_date" type="date" defaultValue={activity.completed_date ?? ""} />
              <Input name="location" placeholder="Location" defaultValue={activity.location ?? ""} />
              <Input
                name="participants_count"
                type="number"
                min="0"
                placeholder="Participants"
                defaultValue={activity.participants_count ?? ""}
              />
            </div>
            <Textarea
              name="description"
              defaultValue={activity.description ?? ""}
              placeholder="Description"
              rows={4}
            />
            <Textarea
              name="narrative_note"
              defaultValue={activity.narrative_note ?? ""}
              placeholder="Completion narrative for the client portal"
              rows={5}
            />
            <Button type="submit">Save activity</Button>
          </form>
        </SectionCard>

        <aside className="space-y-4">
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

          <SectionCard title="Proofs" description={`${proofs.length} attached`}>
            {proofs.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No proofs yet"
                description="Upload files or add links to share evidence of completion."
              />
            ) : (
              <div className="space-y-2">
                {proofs.map((proof) => (
                  <ProofAccessButton
                    key={proof.id}
                    proofId={proof.id}
                    fileName={proof.file_name}
                    caption={proof.caption}
                    kind={proof.kind}
                    hint={proof.kind === "link" ? proof.url : proof.mime_type}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
