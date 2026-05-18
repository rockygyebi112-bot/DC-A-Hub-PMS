import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";
import {
  CalendarDays,
  Columns3,
  Layers,
  ListChecks,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToastForm } from "@/components/ui/toast-form";
import { ProjectIcon } from "@/components/ui/project-icon";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { ProjectProgress } from "@/components/workspace/project-progress";
import { DeleteConfirm } from "@/components/workspace/delete-confirm";
import { createActivity, createPhase, deleteWorkplan } from "@/lib/workspace/actions";
import { getWorkspaceProject, listProjectPhases } from "@/lib/workspace/queries";
import { SetBreadcrumbLabels } from "@/components/shell/breadcrumb-context";
import { ProjectMetricCard } from "./_components/project-metric-card";
import { ProjectPhases } from "./_components/project-phases";
import { ProjectBoard } from "./_components/project-board";
import { ProjectList } from "./_components/project-list";
import { ProjectTimeline } from "./_components/project-timeline";

// Code-split: the workplan import form is a 12 KB client island that's only
// rendered when a project has no phases yet, so most page views never need
// the bundle. `next/dynamic` keeps SSR on (no flash-of-empty), but pushes
// the JS into its own chunk so initial navigation doesn't pay for it.
const WorkplanImportForm = dynamic(() =>
  import("@/components/workspace/workplan-import-form").then(
    (mod) => mod.WorkplanImportForm,
  ),
);

/**
 * Workspace project detail page — the home of phases / board / list / timeline
 * tabs plus quick-action sidebar forms. Previously a single 693-line file; the
 * per-tab presentation is now colocated under `_components/` so each surface
 * can evolve (and be code-reviewed) independently. The page itself is just
 * data-fetch + tab orchestration.
 */
export default async function WorkspaceProjectPage({
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
  const activities = phases.flatMap((phase) =>
    phase.activities.map((activity) => ({ ...activity, phaseName: phase.name })),
  );
  const nextActivity =
    activities
      .filter((activity) => activity.status !== "done" && activity.planned_date)
      .sort((a, b) => (a.planned_date ?? "").localeCompare(b.planned_date ?? ""))[0] ??
    null;

  async function addPhase(formData: FormData) {
    "use server";
    return createPhase(id, formData);
  }

  async function addActivity(formData: FormData) {
    "use server";
    const result = await createActivity(id, formData);
    if (result.ok && result.data) {
      redirect(`/workspace/projects/${id}/activities/${result.data.id}`);
    }
    return result;
  }

  return (
    <>
      <SetBreadcrumbLabels labels={{ [id]: project.name }} />
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <ProjectIcon name={project.name} seed={project.id} />
            <span>{project.name}</span>
          </span>
        }
        subtitle={`${project.client?.name ?? "Client"} · ${project.code}`}
        backFallbackHref="/workspace"
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
            {phases.length > 0 && (
              <DeleteConfirm
                trigger={
                  <Button variant="destructive" size="default">
                    <Trash2 className="size-4" />
                    Delete workplan
                  </Button>
                }
                title="Delete workplan"
                description={
                  <>
                    This will permanently delete <strong>all {phases.length} phases</strong>,{" "}
                    <strong>{activities.length} activities</strong>, and every uploaded document for
                    this project. The project itself will remain.
                  </>
                }
                confirmWord="DELETE"
                action={async () => {
                  "use server";
                  return deleteWorkplan(id);
                }}
              />
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <ProjectMetricCard title="Progress">
          <ProjectProgress done={project.doneCount} total={project.totalCount} />
        </ProjectMetricCard>
        <ProjectMetricCard title="Status">
          <StatusPill status={project.status as "planning" | "active" | "paused" | "completed"} />
        </ProjectMetricCard>
        <ProjectMetricCard title="Next">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{nextActivity?.name ?? "No upcoming work"}</p>
            <p className="text-xs text-muted-foreground">
              {nextActivity?.planned_date ?? "Not scheduled"}
            </p>
          </div>
        </ProjectMetricCard>
        <ProjectMetricCard title="Timeline">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            {project.start_date ?? "TBD"} – {project.end_date ?? "TBD"}
          </div>
        </ProjectMetricCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <Tabs defaultValue="phases" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="phases">
                <Layers className="size-4" />
                Phases
              </TabsTrigger>
              <TabsTrigger value="board">
                <Columns3 className="size-4" />
                Board
              </TabsTrigger>
              <TabsTrigger value="list">
                <ListChecks className="size-4" />
                List
              </TabsTrigger>
              <TabsTrigger value="timeline">
                <CalendarDays className="size-4" />
                Timeline
              </TabsTrigger>
            </TabsList>
            <span className="text-xs text-muted-foreground">
              {phases.length} phases · {activities.length} activities
            </span>
          </div>

          <TabsContent value="phases">
            <ProjectPhases projectId={id} phases={phases} />
          </TabsContent>

          <TabsContent value="board">
            <ProjectBoard projectId={id} phases={phases} activities={activities} />
          </TabsContent>

          <TabsContent value="list">
            <ProjectList projectId={id} phases={phases} activities={activities} />
          </TabsContent>

          <TabsContent value="timeline">
            <ProjectTimeline projectId={id} activities={activities} />
          </TabsContent>
        </Tabs>

        <aside className="space-y-4">
          <div id="import-checklist" className="scroll-mt-20">
            <SectionCard title="Import checklist">
              <WorkplanImportForm projectId={id} />
            </SectionCard>
          </div>

          <SectionCard title="Add phase">
            <ToastForm action={addPhase} successMessage="Phase added" className="space-y-3">
              <Input name="name" placeholder="Inception" required />
              <div className="grid grid-cols-2 gap-2">
                <Input name="start_date" type="date" />
                <Input name="end_date" type="date" />
              </div>
              <Textarea name="description" placeholder="Phase notes" rows={3} />
              <Button type="submit" className="w-full">
                Add phase
              </Button>
            </ToastForm>
          </SectionCard>

          <SectionCard title="Quick activity">
            <ToastForm
              action={addActivity}
              successMessage={null}
              className="space-y-3"
            >
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
            </ToastForm>
          </SectionCard>
        </aside>
      </div>
    </>
  );
}
