import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { createActivity } from "@/lib/workspace/actions";
import { getWorkspaceProject, listProjectPhases } from "@/lib/workspace/queries";
import { SetBreadcrumbLabels } from "@/components/shell/breadcrumb-context";

export default async function NewWorkspaceActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [projectMaybe, phases] = await Promise.all([
    getWorkspaceProject(id),
    listProjectPhases(id),
  ]);
  if (!projectMaybe) notFound();
  const project = projectMaybe;

  async function save(formData: FormData) {
    "use server";
    const result = await createActivity(id, formData);
    if (result.ok && result.data) redirect(`/workspace/projects/${id}/activities/${result.data.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <SetBreadcrumbLabels labels={{ [id]: project.name }} />
      <PageHeader
        title="New activity"
        subtitle={`Add an activity to ${project.name}.`}
        backFallbackHref={`/workspace/projects/${id}`}
      />

      <SectionCard title="Activity details">
        <form action={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Phase
              <select
                name="phase_id"
                required
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              >
                <option value="">Pick a phase</option>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Start date
              <Input name="planned_date" type="date" />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Activity name
            <Input name="name" placeholder="What's the task?" required />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Deliverable
            <Input
              name="deliverable"
              placeholder="What concrete output proves this activity is done?"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Responsible team
            <Input
              name="responsible"
              placeholder="Team member, team, or external partner"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Notes / dependencies
            <Textarea
              name="description"
              placeholder="Anything the team needs to know — prerequisites, references, links."
              rows={5}
            />
          </label>
          <Button type="submit" disabled={phases.length === 0}>
            Create activity
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
