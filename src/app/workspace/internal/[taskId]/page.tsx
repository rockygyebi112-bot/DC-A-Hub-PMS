import { notFound } from 'next/navigation';
import {
  getTask,
  listAreas,
  listInternalTaskProofs,
  listInternalTaskComments,
  listInternalProofComments,
} from '@/lib/internal/queries';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { TaskDetail } from '@/components/internal/task-detail';
import { TaskDocumentsCard } from '@/components/internal/task-documents-card';
import { TaskCommentsCard } from '@/components/internal/task-comments-card';
import { PageHeader } from '@/components/admin/ui/page-header';

export default async function InternalTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const [task, areas, profile, proofs, comments] = await Promise.all([
    getTask(taskId),
    listAreas({ includeArchived: true }),
    getCurrentProfile(),
    listInternalTaskProofs(taskId),
    listInternalTaskComments(taskId),
  ]);
  if (!task || !profile) notFound();

  const commentsByProof = await listInternalProofComments(
    proofs.map((p) => p.id),
  );

  const areaName = areas.find((a) => a.id === task.area_id)?.name;
  const composerUser = {
    name: profile.fullName,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
  };
  const isAdmin = profile.role === 'admin';

  return (
    <>
      <PageHeader
        title={task.title}
        subtitle={areaName}
        backFallbackHref="/workspace/internal"
      />
      <TaskDetail task={task} areas={areas} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <TaskDocumentsCard
          taskId={taskId}
          proofs={proofs}
          commentsByProof={commentsByProof}
          user={composerUser}
          currentUserId={profile.userId}
          isAdmin={isAdmin}
        />
        <TaskCommentsCard
          taskId={taskId}
          comments={comments}
          user={composerUser}
          currentUserId={profile.userId}
          isAdmin={isAdmin}
        />
      </div>
    </>
  );
}
