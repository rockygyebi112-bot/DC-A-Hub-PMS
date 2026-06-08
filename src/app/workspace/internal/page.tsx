import { redirect } from 'next/navigation';
import { CheckCircle2, Circle, ListTodo, Timer, TriangleAlert, type LucideIcon } from 'lucide-react';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { listAreas, listTasks } from '@/lib/internal/queries';
import { TaskBoard } from '@/components/internal/task-board';
import { NewTaskForm } from '@/components/internal/new-task-form';
import { FilterChips } from '@/components/admin/ui/filter-chips';
import { asTaskStatus, type TaskStatus } from '@/components/internal/task-meta';
import { cn } from '@/lib/utils';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

export default async function InternalWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; status?: string; project?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
    redirect('/');
  }

  const params = await searchParams;
  const [areas, tasks, allTasks] = await Promise.all([
    listAreas(),
    listTasks({
      areaId: params.area,
      status: params.status,
      projectId: params.project,
    }),
    listTasks({ projectId: params.project }),
  ]);

  const areaOptions = areas.map((a) => ({ value: a.id, label: a.name }));
  const statusCounts = allTasks.reduce(
    (acc, task) => {
      acc[asTaskStatus(task.status)] += 1;
      return acc;
    },
    {
      not_started: 0,
      in_progress: 0,
      blocked: 0,
      done: 0,
    } satisfies Record<TaskStatus, number>,
  );
  const areaCounts = areas.reduce<Record<string, number>>((acc, area) => {
    acc[area.id] = allTasks.filter((task) => task.area_id === area.id).length;
    return acc;
  }, {});
  const openTasks = allTasks.length - statusCounts.done;
  const dueToday = todayIso();
  const overdueTasks = allTasks.filter(
    (task) => task.status !== 'done' && task.due_date && task.due_date < dueToday,
  ).length;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-5 border-b border-border px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <ListTodo className="size-3.5" />
              Team board
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              Internal workspace
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Plan DC&A Hub internal work, track blockers, and keep ownership visible before anything reaches clients.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <NewTaskForm areas={areas} />
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x-0 divide-y border-b border-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <WorkspaceMetric
            label="Open"
            value={openTasks}
            icon={Circle}
            tone="text-slate-500"
          />
          <WorkspaceMetric
            label="In progress"
            value={statusCounts.in_progress}
            icon={Timer}
            tone="text-blue-500"
          />
          <WorkspaceMetric
            label="Blocked"
            value={statusCounts.blocked}
            icon={TriangleAlert}
            tone="text-red-500"
          />
          <WorkspaceMetric
            label="Done"
            value={statusCounts.done}
            icon={CheckCircle2}
            tone="text-emerald-500"
          />
        </div>

        <div
          aria-label="Task filters"
          role="group"
          className="space-y-3 px-4 py-4 sm:px-6"
        >
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-2">
              <FilterChips
                paramName="status"
                options={STATUS_FILTERS}
                allLabel="All statuses"
                counts={statusCounts}
              />
              <FilterChips
                paramName="area"
                options={areaOptions}
                allLabel="All areas"
                counts={areaCounts}
              />
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <TriangleAlert className={cn('size-3.5', overdueTasks > 0 && 'text-destructive')} />
              {overdueTasks} overdue
            </div>
          </div>
        </div>
      </section>

      <TaskBoard tasks={tasks} areas={areas} />
    </div>
  );
}

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate(),
  ).padStart(2, '0')}`;
}

function WorkspaceMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-4 sm:px-6">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md bg-muted', tone)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      </div>
    </div>
  );
}
