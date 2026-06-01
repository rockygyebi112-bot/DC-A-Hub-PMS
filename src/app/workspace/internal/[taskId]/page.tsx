import { notFound } from 'next/navigation';
import { getTask, listAreas } from '@/lib/internal/queries';
import { TaskDetail } from '@/components/internal/task-detail';
import { PageHeader } from '@/components/admin/ui/page-header';

export default async function InternalTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const [task, areas] = await Promise.all([
    getTask(taskId),
    listAreas({ includeArchived: true }),
  ]);
  if (!task) notFound();

  const areaName = areas.find((a) => a.id === task.area_id)?.name;

  return (
    <>
      <PageHeader
        title={task.title}
        subtitle={areaName}
        backFallbackHref="/workspace/internal"
      />
      <TaskDetail task={task} areas={areas} />
    </>
  );
}
