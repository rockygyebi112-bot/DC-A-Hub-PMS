import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Columns3,
  FileSpreadsheet,
  ListChecks,
  MoreVertical,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ProjectIcon } from "@/components/ui/project-icon";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { ProjectProgress } from "@/components/workspace/project-progress";
import { WorkplanImportForm } from "@/components/workspace/workplan-import-form";
import { DeleteConfirm } from "@/components/workspace/delete-confirm";
import {
  createActivity,
  createPhase,
  deleteActivity,
  deletePhase,
  deleteWorkplan,
} from "@/lib/workspace/actions";
import {
  getWorkspaceProject,
  listProjectPhases,
  type WorkspaceActivity,
  type WorkspacePhase,
} from "@/lib/workspace/queries";

const BOARD_COLUMNS: {
  key: WorkspaceActivity["status"];
  label: string;
  icon: typeof ClipboardList;
}[] = [
  { key: "not_started", label: "Not started", icon: ClipboardList },
  { key: "in_progress", label: "Ongoing", icon: Columns3 },
  { key: "done", label: "Done", icon: CheckCircle2 },
];

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
    await createPhase(id, formData);
  }

  async function addActivity(formData: FormData) {
    "use server";
    const result = await createActivity(id, formData);
    if (result.ok && result.data) {
      redirect(`/workspace/projects/${id}/activities/${result.data.id}`);
    }
  }

  return (
    <>
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
            <Button variant="outline" render={<a href="#import-checklist" />}>
              <FileSpreadsheet className="size-4" />
              Import checklist
            </Button>
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
                    <strong>{activities.length} activities</strong>, and every uploaded proof for
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

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard title="Progress">
          <ProjectProgress done={project.doneCount} total={project.totalCount} />
        </MetricCard>
        <MetricCard title="Status">
          <StatusPill status={project.status as "planning" | "active" | "paused" | "completed"} />
        </MetricCard>
        <MetricCard title="Next">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{nextActivity?.name ?? "No upcoming work"}</p>
            <p className="text-xs text-muted-foreground">
              {nextActivity?.planned_date ?? "Not scheduled"}
            </p>
          </div>
        </MetricCard>
        <MetricCard title="Timeline">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            {project.start_date ?? "TBD"} – {project.end_date ?? "TBD"}
          </div>
        </MetricCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Tabs defaultValue="board" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <TabsList>
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

          <SectionCard title="Quick activity">
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
    </>
  );
}

function MetricCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function ProjectBoard({
  projectId,
  phases,
  activities,
}: {
  projectId: string;
  phases: WorkspacePhase[];
  activities: (WorkspaceActivity & { phaseName: string })[];
}) {
  if (phases.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          variant="page"
          icon={ClipboardList}
          title="No phases"
          description="Create the first phase to start building the workplan."
        />
      </SectionCard>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-3">
      {BOARD_COLUMNS.map((column) => {
        const Icon = column.icon;
        const rows = activities.filter((activity) => activity.status === column.key);
        return (
          <section key={column.key} className="rounded-xl border bg-muted/30">
            <header className="flex items-center justify-between gap-3 border-b px-3 py-2">
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{column.label}</h2>
              </div>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                {rows.length}
              </span>
            </header>
            <div className="space-y-2 p-2">
              {rows.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-background/60 px-3 py-8 text-center text-xs text-muted-foreground">
                  Empty
                </div>
              ) : (
                rows.map((activity) => (
                  <ActivityCard key={activity.id} projectId={projectId} activity={activity} />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ActivityCard({
  projectId,
  activity,
}: {
  projectId: string;
  activity: WorkspaceActivity & { phaseName: string };
}) {
  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm transition-colors hover:bg-accent/50">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/workspace/projects/${projectId}/activities/${activity.id}`}
          className="min-w-0 flex-1"
        >
          <p className="truncate text-sm font-medium hover:underline">{activity.name}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{activity.phaseName}</p>
        </Link>
        <ActivityStatus status={activity.status} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{activity.planned_date ?? "No date"}</span>
          {activity.location && <span>· {activity.location}</span>}
          {activity.proofCount > 0 && <span>· {activity.proofCount} proofs</span>}
        </div>
        <DeleteConfirm
          trigger={
            <button
              type="button"
              aria-label="Delete activity"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          }
          title={`Delete activity`}
          description={
            <>
              Delete <strong>{activity.name}</strong>? This will remove all proofs uploaded to it.
            </>
          }
          action={async () => {
            "use server";
            return deleteActivity(activity.id);
          }}
        />
      </div>
    </div>
  );
}

function ProjectList({
  projectId,
  phases,
  activities,
}: {
  projectId: string;
  phases: WorkspacePhase[];
  activities: (WorkspaceActivity & { phaseName: string })[];
}) {
  if (activities.length === 0) {
    return (
      <SectionCard>
        <EmptyState icon={ClipboardList} title="No activities" description="Add activities to the workplan." />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {phases.length > 0 && (
        <SectionCard title="Phases" description={`${phases.length} phases in this workplan`}>
          <ul className="divide-y">
            {phases.map((phase) => (
              <li key={phase.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{phase.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {phase.activities.length} activities
                    {phase.start_date || phase.end_date
                      ? ` · ${phase.start_date ?? "TBD"} – ${phase.end_date ?? "TBD"}`
                      : ""}
                  </p>
                </div>
                <DeleteConfirm
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label="Delete phase">
                      <MoreVertical className="size-4" />
                    </Button>
                  }
                  title="Delete phase"
                  description={
                    <>
                      Delete <strong>{phase.name}</strong> and its{" "}
                      <strong>{phase.activities.length} activities</strong>? Proofs will be deleted too.
                    </>
                  }
                  confirmWord={phase.activities.length > 0 ? "DELETE" : undefined}
                  action={async () => {
                    "use server";
                    return deletePhase(phase.id);
                  }}
                />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Planned</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Proofs</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => (
                <TableRow key={activity.id} style={{ height: "var(--admin-row-h)" }}>
                  <TableCell>
                    <Link
                      href={`/workspace/projects/${projectId}/activities/${activity.id}`}
                      className="font-medium hover:underline"
                    >
                      {activity.name}
                    </Link>
                  </TableCell>
                  <TableCell>{activity.phaseName}</TableCell>
                  <TableCell>
                    <ActivityStatus status={activity.status} />
                  </TableCell>
                  <TableCell>{activity.planned_date ?? "—"}</TableCell>
                  <TableCell>{activity.location ?? "—"}</TableCell>
                  <TableCell>{activity.proofCount}</TableCell>
                  <TableCell className="text-right">
                    <DeleteConfirm
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Delete activity">
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      title="Delete activity"
                      description={
                        <>
                          Delete <strong>{activity.name}</strong>? This will remove all proofs uploaded to it.
                        </>
                      }
                      action={async () => {
                        "use server";
                        return deleteActivity(activity.id);
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}

function ProjectTimeline({
  projectId,
  activities,
}: {
  projectId: string;
  activities: (WorkspaceActivity & { phaseName: string })[];
}) {
  const scheduled = activities
    .filter((activity) => activity.planned_date || activity.completed_date)
    .sort((a, b) =>
      (a.planned_date ?? a.completed_date ?? "").localeCompare(
        b.planned_date ?? b.completed_date ?? "",
      ),
    );

  if (scheduled.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          icon={CalendarDays}
          title="No scheduled work"
          description="Add planned or completed dates to see the timeline."
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <ol className="relative space-y-4 border-l pl-5">
        {scheduled.map((activity) => (
          <li key={activity.id} className="relative">
            <span className="absolute -left-[1.65rem] top-1.5 size-3 rounded-full border-2 border-background bg-primary" />
            <Link
              href={`/workspace/projects/${projectId}/activities/${activity.id}`}
              className="block rounded-lg border bg-background p-3 transition-colors hover:bg-accent"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{activity.name}</p>
                  <p className="text-xs text-muted-foreground">{activity.phaseName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ActivityStatus status={activity.status} />
                  <time className="text-xs text-muted-foreground">
                    {activity.planned_date ?? activity.completed_date}
                  </time>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
