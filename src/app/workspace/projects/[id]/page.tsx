import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Columns3,
  FileUp,
  Layers,
  ListChecks,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { getEvaluationForProject } from "@/lib/evaluations/queries";
import { listTasks } from "@/lib/internal/queries";
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
  const [projectMaybe, phases, internalTasks, evaluation] = await Promise.all([
    getWorkspaceProject(id),
    listProjectPhases(id),
    listTasks({ projectId: id }),
    getEvaluationForProject(id),
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
          <div className="flex flex-wrap items-center gap-2">
            {internalTasks.length > 0 && (
              <a
                href={`/workspace/internal?project=${id}`}
                className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900"
              >
                Internal tasks ({internalTasks.length})
              </a>
            )}
            <Button variant="outline" render={<Link href={`/workspace/projects/${id}/team`} />}>
              <Users className="size-4" />
              Team
            </Button>
            <Button render={<Link href={`/workspace/projects/${id}/activities/new`} />}>
              <Plus className="size-4" />
              Activity
            </Button>
            {phases.length > 0 && (
              <>
                <span className="mx-1 hidden h-6 w-px bg-border md:inline-block" aria-hidden />
                <DeleteConfirm
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete workplan"
                      title="Delete workplan"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
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
              </>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <ProjectMetricCard title="Progress">
          <ProjectProgress
            done={project.clientDoneCount}
            total={project.clientTotalCount}
          />
          {project.totalCount !== project.clientTotalCount && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Overall (includes internal): {project.doneCount} / {project.totalCount}
            </p>
          )}
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

      {phases.length === 0 && (
        <SectionCard title="Get started">
          <EmptyState
            variant="page"
            icon={Layers}
            title="This project has no workplan yet"
            description="Import a workplan from Excel or add your first phase using the form on the right. Activities can then be planned under each phase."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button render={<a href="#import-checklist" />}>
                  <FileUp className="size-4" />
                  Import workplan
                </Button>
                <Button variant="outline" render={<Link href={`/workspace/projects/${id}/activities/new`} />}>
                  <Plus className="size-4" />
                  Add activity
                </Button>
              </div>
            }
          />
        </SectionCard>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <Tabs defaultValue="phases" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
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
              {evaluation && (
                <Link
                  href={`/workspace/projects/${id}/dashboard`}
                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-muted px-3 py-1 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0"
                >
                  <BarChart3 />
                  Data Collection
                </Link>
              )}
            </div>
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
          {phases.length === 0 && (
            <div id="import-checklist" className="scroll-mt-20">
              <SectionCard title="Import checklist">
                <WorkplanImportForm projectId={id} />
              </SectionCard>
            </div>
          )}

          <SectionCard title="Add phase">
            <ToastForm action={addPhase} successMessage="Phase added" className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="phase-name">Phase name</Label>
                <Input id="phase-name" name="name" placeholder="Inception" required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="phase-start">Start date</Label>
                  <Input id="phase-start" name="start_date" type="date" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phase-end">End date</Label>
                  <Input id="phase-end" name="end_date" type="date" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phase-notes">Notes</Label>
                <Textarea id="phase-notes" name="description" placeholder="Optional context" rows={3} />
              </div>
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
              <div className="space-y-1.5">
                <Label htmlFor="quick-activity-phase">Phase</Label>
                <Select name="phase_id" required>
                  <SelectTrigger id="quick-activity-phase" size="sm" className="w-full">
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
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-activity-name">Activity name</Label>
                <Input id="quick-activity-name" name="name" placeholder="e.g. Stakeholder interviews" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-activity-date">Planned date</Label>
                <Input id="quick-activity-date" name="planned_date" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-activity-location">Location</Label>
                <Input id="quick-activity-location" name="location" placeholder="Optional" />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">
                  Visibility <span className="text-destructive">*</span>
                </legend>
                <p className="text-xs text-muted-foreground">
                  Internal-only activities are hidden from the client portal but visible to admin and assigned staff.
                </p>
                <div className="flex gap-4">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="visibility"
                      value="client_visible"
                      required
                      className="size-4 accent-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    Client-visible
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="visibility"
                      value="internal"
                      required
                      className="size-4 accent-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    Internal only
                  </label>
                </div>
              </fieldset>
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
