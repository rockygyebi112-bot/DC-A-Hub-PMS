import { notFound } from 'next/navigation';
import { getTask, listAreas } from '@/lib/internal/queries';
import { TaskDetail } from '@/components/internal/task-detail';

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
  return (
    <main className="p-6">
      <TaskDetail task={task} areas={areas} />
    </main>
  );
}
