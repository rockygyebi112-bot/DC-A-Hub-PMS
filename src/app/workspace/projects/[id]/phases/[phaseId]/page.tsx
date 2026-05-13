import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { DeleteConfirm } from "@/components/workspace/delete-confirm";
import { deletePhase, updatePhase } from "@/lib/workspace/actions";
import { getPhase, listProjectPhases } from "@/lib/workspace/queries";

export default async function WorkspacePhasePage({
  params,
}: {
  params: Promise<{ id: string; phaseId: string }>;
}) {
  const { id, phaseId } = await params;
  const [phase, allPhases] = await Promise.all([getPhase(phaseId), listProjectPhases(id)]);
  const activityCount = allPhases.find((p) => p.id === phaseId)?.activities.length ?? 0;

  async function save(formData: FormData) {
    "use server";
    await updatePhase(phaseId, formData);
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title={phase.name}
        subtitle="Edit phase details and dates."
        backFallbackHref={`/workspace/projects/${id}`}
        action={
          <DeleteConfirm
            trigger={
              <Button variant="destructive" size="sm">
                <Trash2 className="size-4" />
                Delete phase
              </Button>
            }
            title="Delete phase"
            description={
              <>
                Delete <strong>{phase.name}</strong> and its <strong>{activityCount} activities</strong>?
                All documents will be removed.
              </>
            }
            confirmWord={activityCount > 0 ? "DELETE" : undefined}
            redirectTo={`/workspace/projects/${id}`}
            action={async () => {
              "use server";
              return deletePhase(phaseId);
            }}
          />
        }
      />

      <SectionCard title="Phase details">
        <form action={save} className="space-y-4">
          <Input name="name" defaultValue={phase.name} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="start_date" type="date" defaultValue={phase.start_date ?? ""} />
            <Input name="end_date" type="date" defaultValue={phase.end_date ?? ""} />
          </div>
          <Textarea
            name="description"
            defaultValue={phase.description ?? ""}
            placeholder="Phase notes"
            rows={5}
          />
          <Button type="submit">Save phase</Button>
        </form>
      </SectionCard>
    </div>
  );
}
