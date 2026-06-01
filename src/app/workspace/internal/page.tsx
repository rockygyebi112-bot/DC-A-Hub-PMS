import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { listAreas, listTasks } from '@/lib/internal/queries';
import { TaskBoard } from '@/components/internal/task-board';
import { NewTaskForm } from '@/components/internal/new-task-form';
import { PageHeader } from '@/components/admin/ui/page-header';
import { FilterChips } from '@/components/admin/ui/filter-chips';

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
  const [areas, tasks] = await Promise.all([
    listAreas(),
    listTasks({
      areaId: params.area,
      status: params.status,
      projectId: params.project,
    }),
  ]);

  const areaOptions = areas.map((a) => ({ value: a.id, label: a.name }));

  return (
    <>
      <PageHeader
        title="Internal workspace"
        subtitle="DC&A Hub internal tasks. Not visible to clients."
        backFallbackHref="/workspace"
        action={<NewTaskForm areas={areas} />}
      />

      <div
        aria-label="Task filters"
        role="group"
        className="mb-5 space-y-2"
      >
        <FilterChips paramName="area" options={areaOptions} allLabel="All areas" />
        <FilterChips
          paramName="status"
          options={STATUS_FILTERS}
          allLabel="All statuses"
        />
      </div>

      <TaskBoard tasks={tasks} areas={areas} />
    </>
  );
}
