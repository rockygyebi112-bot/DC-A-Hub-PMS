import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { updateActivity, uploadProofs } from "@/lib/workspace/actions";
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

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
      <PageHeader
        title={activity.name}
        subtitle={`${activity.phase?.project?.name ?? "Project"} / ${activity.phase?.name ?? "Phase"}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ActivityStatus status={activity.status} />
            <Button variant="ghost" size="sm" render={<Link href={`/workspace/projects/${id}`} />}>
              Back
            </Button>
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
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
              </label>
            </div>
            <Input name="name" defaultValue={activity.name} required />
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
            title="Proof upload"
            description="Files are stored privately and shared through signed links."
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

          <SectionCard title="Proofs" description={`${proofs.length} uploaded`}>
            {proofs.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No proofs yet"
                description="Upload photos, PDFs, or other completion evidence."
              />
            ) : (
              <div className="space-y-2">
                {proofs.map((proof) => (
                  <a
                    key={proof.id}
                    href={proof.signedUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border bg-background p-3 text-sm transition-colors hover:bg-accent"
                  >
                    <span className="font-medium">{proof.file_name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {proof.caption ?? "No caption"}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </SectionCard>
        </aside>
      </div>
    </main>
  );
}

