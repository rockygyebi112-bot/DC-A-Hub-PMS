import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ClipboardList, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { ProjectProgress } from "@/components/workspace/project-progress";
import { createActivity, createPhase } from "@/lib/workspace/actions";
import { getWorkspaceProject, listProjectPhases } from "@/lib/workspace/queries";

export default async function WorkspaceProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, phases] = await Promise.all([
    getWorkspaceProject(id),
    listProjectPhases(id),
  ]);

  async function addPhase(formData: FormData) {
    "use server";
    await createPhase(id, formData);
  }

  async function addActivity(formData: FormData) {
    "use server";
    const result = await createActivity(id, formData);
    if (result.ok && result.data) redirect(`/workspace/projects/${id}/activities/${result.data.id}`);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
      <PageHeader
        title={project.name}
        subtitle={`${project.client?.name ?? "Client"} / ${project.code}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href={`/workspace/projects/${id}/team`} />}>
              <Users className="size-4" />
              Team
            </Button>
            <Button render={<Link href={`/workspace/projects/${id}/activities/new`} />}>
              <Plus className="size-4" />
              Activity
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <SectionCard title="Progress">
          <ProjectProgress done={project.doneCount} total={project.totalCount} />
        </SectionCard>
        <SectionCard title="Status">
          <StatusPill status={project.status as "planning" | "active" | "paused" | "completed"} />
        </SectionCard>
        <SectionCard title="Timeline">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            {project.start_date ?? "TBD"} - {project.end_date ?? "TBD"}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {phases.length === 0 ? (
            <SectionCard>
              <EmptyState
                variant="page"
                icon={ClipboardList}
                title="No phases yet"
                description="Add the first phase to start building the workplan."
              />
            </SectionCard>
          ) : (
            phases.map((phase) => (
              <SectionCard
                key={phase.id}
                title={phase.name}
                description={phase.description ?? undefined}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/workspace/projects/${id}/phases/${phase.id}`} />}
                  >
                    Edit
                  </Button>
                }
              >
                {phase.activities.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="No activities"
                    description="Add an activity under this phase."
                  />
                ) : (
                  <div className="grid gap-2">
                    {phase.activities.map((activity) => (
                      <Link
                        key={activity.id}
                        href={`/workspace/projects/${id}/activities/${activity.id}`}
                        className="flex flex-col gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-accent sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{activity.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {activity.location ?? "No location"} / {activity.planned_date ?? "No planned date"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {activity.proofCount > 0 && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {activity.proofCount} proofs
                            </span>
                          )}
                          <ActivityStatus status={activity.status} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </SectionCard>
            ))
          )}
        </div>

        <aside className="space-y-4">
          <SectionCard title="Add phase" description="Create a workplan section.">
            <form action={addPhase} className="space-y-3">
              <Input name="name" placeholder="Inception" required />
              <div className="grid grid-cols-2 gap-2">
                <Input name="start_date" type="date" />
                <Input name="end_date" type="date" />
              </div>
              <Textarea name="description" placeholder="Phase notes" rows={3} />
              <Button type="submit" className="w-full">
                Add phase
              </Button>
            </form>
          </SectionCard>

          <SectionCard title="Quick activity" description="Add an activity to any phase.">
            <form action={addActivity} className="space-y-3">
              <select
                name="phase_id"
                required
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
              >
                <option value="">Pick a phase</option>
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name}
                  </option>
                ))}
              </select>
              <Input name="name" placeholder="Activity name" required />
              <Input name="planned_date" type="date" />
              <Input name="location" placeholder="Location" />
              <Button type="submit" className="w-full" disabled={phases.length === 0}>
                Add activity
              </Button>
            </form>
          </SectionCard>
        </aside>
      </div>
    </main>
  );
}

