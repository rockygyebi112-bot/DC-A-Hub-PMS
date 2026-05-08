import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { createActivity } from "@/lib/workspace/actions";
import { getWorkspaceProject, listProjectPhases } from "@/lib/workspace/queries";

export default async function NewWorkspaceActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, phases] = await Promise.all([
    getWorkspaceProject(id),
    listProjectPhases(id),
  ]);

  async function save(formData: FormData) {
    "use server";
    const result = await createActivity(id, formData);
    if (result.ok && result.data) redirect(`/workspace/projects/${id}/activities/${result.data.id}`);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
      <PageHeader
        title="New activity"
        subtitle={`Add an activity to ${project.name}.`}
        action={
          <Button variant="ghost" size="sm" render={<Link href={`/workspace/projects/${id}`} />}>
            Back to project
          </Button>
        }
      />

      <SectionCard title="Activity details">
        <form action={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
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
              Planned date
              <Input name="planned_date" type="date" />
            </label>
          </div>
          <Input name="name" placeholder="Activity name" required />
          <Input name="location" placeholder="Location" />
          <Textarea name="description" placeholder="Description" rows={5} />
          <Button type="submit" disabled={phases.length === 0}>
            Create activity
          </Button>
        </form>
      </SectionCard>
    </main>
  );
}

