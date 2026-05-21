import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
              <Select name="phase_id" required>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="Pick a phase" />
                </SelectTrigger>
                <SelectContent>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-800 dark:text-gray-100">
              Visibility <span className="text-red-600">*</span>
            </legend>
            <p className="text-xs text-gray-500">
              Internal-only activities are hidden from the client portal but visible to admin and assigned staff.
            </p>
            <div className="flex gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="radio" name="visibility" value="client_visible" required />
                Client-visible
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="radio" name="visibility" value="internal" required />
                Internal only
              </label>
            </div>
          </fieldset>
          <Button type="submit" disabled={phases.length === 0}>
            Create activity
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
