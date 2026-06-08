import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Layers3,
} from 'lucide-react';
import {
  getTask,
  listAreas,
  listInternalTaskProofs,
  listInternalTaskComments,
  listInternalProofComments,
} from '@/lib/internal/queries';
import { getCurrentProfile } from '@/lib/auth/get-current-profile';
import { listWorkspaceProjects } from '@/lib/workspace/queries';
import { TaskDetail } from '@/components/internal/task-detail';
import { TaskDocumentsCard } from '@/components/internal/task-documents-card';
import { TaskCommentsCard } from '@/components/internal/task-comments-card';
import { Badge } from '@/components/ui/badge';
import { asTaskStatus, TASK_STATUS_META } from '@/components/internal/task-meta';

export default async function InternalTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const [task, areas, projects, profile, proofs, comments] = await Promise.all([
    getTask(taskId),
    listAreas({ includeArchived: true }),
    listWorkspaceProjects({ sort: 'name' }).catch(() => []),
    getCurrentProfile(),
    listInternalTaskProofs(taskId),
    listInternalTaskComments(taskId),
  ]);
  if (!task || !profile) notFound();

  const commentsByProof = await listInternalProofComments(
    proofs.map((p) => p.id),
  );

  const areaName = areas.find((a) => a.id === task.area_id)?.name;
  const project = task.project_id
    ? projects.find((p) => p.id === task.project_id)
    : undefined;
  const status = asTaskStatus(task.status);
  const statusMeta = TASK_STATUS_META[status];
  const composerUser = {
    name: profile.fullName,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
  };
  const isAdmin = profile.role === 'admin';

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border bg-background/70 px-4 py-3">
          <Link
            href="/workspace/internal"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Internal workspace
          </Link>
        </div>
        <div className="flex flex-col gap-4 px-4 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status === 'done' ? 'success' : status === 'blocked' ? 'destructive' : 'info'} dot>
                {statusMeta.label}
              </Badge>
              {task.due_date && (
                <Badge variant="outline">
                  <CalendarDays className="size-3" />
                  Due {formatDate(task.due_date)}
                </Badge>
              )}
            </div>
            <h1 className="mt-3 max-w-5xl font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {task.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <HeaderChip icon={<Layers3 className="size-3.5" />} label={areaName ?? 'Unassigned workstream'} />
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
            </div>
          </div>
        </div>
      </section>

      <TaskDetail task={task} areas={areas} projects={projects} />
      <div className="grid gap-5 lg:grid-cols-2">
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

function HeaderChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1">
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}
