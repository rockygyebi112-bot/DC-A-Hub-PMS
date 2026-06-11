import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Flag,
  Layers3,
} from 'lucide-react';

import {
  getTask,
  listAreas,
  listInternalTaskComments,
  listInternalProofComments,
  listInternalTaskProofs,
  listSubtasks,
} from '@/lib/internal/queries';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { listWorkspaceProjects } from '@/lib/workspace/queries';
import { TaskDetail } from '@/components/internal/task-detail';
import { SubtasksCard } from '@/components/internal/subtasks-card';
import { TaskDocumentsCard } from '@/components/internal/task-documents-card';
import { TaskCommentsCard } from '@/components/internal/task-comments-card';
import { Badge } from '@/components/ui/badge';
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  asTaskStatus,
  type TaskPriority,
} from '@/components/internal/task-meta';

export default async function InternalTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const [task, areas, projects, profile, proofs, comments, subtasks] = await Promise.all([
    getTask(taskId),
    listAreas({ includeArchived: true }),
    listWorkspaceProjects({ sort: 'name' }).catch(() => []),
    getCurrentProfile(),
    listInternalTaskProofs(taskId),
    listInternalTaskComments(taskId),
    listSubtasks(taskId),
  ]);
  if (!task || !profile) notFound();

  const commentsByProof = await listInternalProofComments(
    proofs.map((p) => p.id),
  );

  const area = areas.find((a) => a.id === task.area_id);
  const project = task.project_id
    ? projects.find((p) => p.id === task.project_id)
    : undefined;
  const status = asTaskStatus(task.status);
  const statusMeta = TASK_STATUS_META[status];
  const priority =
    task.priority && task.priority in TASK_PRIORITY_META
      ? TASK_PRIORITY_META[task.priority as TaskPriority]
      : null;
  const composerUser = {
    name: profile.fullName,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
  };
  const isAdmin = profile.role === 'admin';

  return (
    <div className="space-y-5">
      <section className="border-b border-border/70 pb-5">
        <Link
          href="/workspace/internal"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Internal Workspace
        </Link>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status === 'done' ? 'success' : status === 'blocked' ? 'destructive' : 'info'} dot>
                {statusMeta.label}
              </Badge>
              {priority && (
                <Badge variant={priority.variant}>
                  <Flag className="size-3" />
                  {priority.label}
                </Badge>
              )}
            </div>
            <h1 className="mt-3 max-w-5xl text-2xl font-semibold leading-tight text-foreground md:text-3xl">
              {task.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <HeaderChip icon={<Layers3 className="size-3.5" />} label={area?.name ?? 'No section'} color={area?.color} />
              <HeaderChip
                icon={<BriefcaseBusiness className="size-3.5" />}
                label={
                  project
                    ? project.client?.name
                      ? `${project.name} - ${project.client.name}`
                      : project.name
                    : 'No linked project'
                }
              />
              {task.due_date && (
                <HeaderChip
                  icon={<CalendarDays className="size-3.5" />}
                  label={`Due ${formatDate(task.due_date)}`}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <TaskDetail task={task} areas={areas} projects={projects} />

      <SubtasksCard taskId={taskId} subtasks={subtasks} />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <TaskCommentsCard
          taskId={taskId}
          comments={comments}
          user={composerUser}
          currentUserId={profile.userId}
          isAdmin={isAdmin}
        />
        <TaskDocumentsCard
          taskId={taskId}
          proofs={proofs}
          commentsByProof={commentsByProof}
          user={composerUser}
          currentUserId={profile.userId}
          isAdmin={isAdmin}
        />
      </section>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function HeaderChip({
  icon,
  label,
  color,
}: {
  icon: ReactNode;
  label: string;
  color?: string | null;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 shadow-sm">
      {color && (
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}
