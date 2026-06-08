'use client';

import type { ReactNode } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  BriefcaseBusiness,
  CalendarDays,
  Flag,
  Layers3,
  Save,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  setTaskStatus,
  updateTask,
  addAssignee,
  removeAssignee,
} from '@/lib/internal/actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/admin/ui/user-avatar';
import { cn } from '@/lib/utils';
import {
  TASK_PRIORITY_ORDER,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  asTaskStatus,
  type TaskStatus,
  type TaskPriority,
} from './task-meta';
import { AssigneePicker } from './assignee-picker';

type Assignee = {
  user_id: string;
  profile: {
    user_id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  area_id: string;
  project_id?: string | null;
  status: string;
  priority?: string | null;
  due_date?: string | null;
  assignees?: Assignee[] | null;
};

type Area = { id: string; name: string; color?: string | null };
type Project = { id: string; name: string; client?: { name: string } | null };
type ActionFn = () => Promise<{ ok: boolean; error?: string }>;

export function TaskDetail({
  task,
  areas,
  projects = [],
}: {
  task: Task;
  areas: Area[];
  projects?: Project[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<TaskStatus>(asTaskStatus(task.status));
  const [priority, setPriority] = useState(task.priority ?? '');
  const [due, setDue] = useState(task.due_date ?? '');
  const [areaId, setAreaId] = useState(task.area_id);
  const [projectId, setProjectId] = useState(task.project_id ?? '');

  function run(fn: ActionFn, okMsg: string, opts?: { onError?: () => void; refresh?: boolean }) {
    start(() => {
      void fn()
        .then((r) => {
          if (r.ok) {
            toast.success(okMsg);
            if (opts?.refresh) router.refresh();
          } else {
            toast.error(r.error ?? 'Something went wrong');
            opts?.onError?.();
          }
        })
        .catch(() => {
          toast.error('Something went wrong');
          opts?.onError?.();
        });
    });
  }

  function patch(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  function onStatusChange(next: TaskStatus) {
    const prev = status;
    setStatus(next);
    run(() => setTaskStatus(task.id, next), 'Status updated', {
      refresh: true,
      onError: () => setStatus(prev),
    });
  }

  function onPriorityChange(value: string | null) {
    const next = value ?? '';
    const prev = priority;
    setPriority(next);
    run(() => updateTask(task.id, patch({ priority: next })), 'Priority updated', {
      onError: () => setPriority(prev),
    });
  }

  function onDueChange(value: string) {
    const prev = due;
    setDue(value);
    run(() => updateTask(task.id, patch({ due_date: value })), 'Due date updated', {
      onError: () => setDue(prev),
    });
  }

  function onAreaChange(value: string | null) {
    const next = value ?? areaId;
    const prev = areaId;
    setAreaId(next);
    run(() => updateTask(task.id, patch({ area_id: next })), 'Workstream updated', {
      refresh: true,
      onError: () => setAreaId(prev),
    });
  }

  function onProjectChange(value: string | null) {
    const next = value === '__none' ? '' : value ?? '';
    const prev = projectId;
    setProjectId(next);
    run(() => updateTask(task.id, patch({ project_id: next })), 'Project link updated', {
      refresh: true,
      onError: () => setProjectId(prev),
    });
  }

  const assignees = (task.assignees ?? []).filter((a) => a.profile);
  const statusMeta = TASK_STATUS_META[status];
  const priorityMeta =
    priority && priority in TASK_PRIORITY_META
      ? TASK_PRIORITY_META[priority as TaskPriority]
      : null;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="space-y-5">
        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Task brief</h2>
                <p className="text-xs text-muted-foreground">
                  Keep the objective, context, and handoff notes current.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={status === 'done' ? 'success' : status === 'blocked' ? 'destructive' : 'info'} dot>
                  {statusMeta.label}
                </Badge>
                {priorityMeta && (
                  <Badge variant={priorityMeta.variant}>
                    <Flag className="size-3" />
                    {priorityMeta.label}
                  </Badge>
                )}
              </div>
            </div>
          </header>
          <form
            action={(fd) => run(() => updateTask(task.id, fd), 'Task brief saved', { refresh: true })}
            className="space-y-4 p-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Title</Label>
              <Input id="task-title" name="title" defaultValue={task.title} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                name="description"
                defaultValue={task.description ?? ''}
                rows={9}
                placeholder="Add objective, context, decisions, links, dependencies, and success criteria."
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={pending}>
                <Save />
                Save brief
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Status pipeline</h2>
            <p className="text-xs text-muted-foreground">
              Update the task stage as work progresses.
            </p>
          </header>
          <div className="grid gap-2 p-3 sm:grid-cols-4">
            {TASK_STATUS_ORDER.map((item) => {
              const meta = TASK_STATUS_META[item];
              const Icon = meta.icon;
              const selected = item === status;
              return (
                <button
                  key={item}
                  type="button"
                  disabled={pending}
                  onClick={() => onStatusChange(item)}
                  className={cn(
                    "flex min-h-20 flex-col items-start justify-between rounded-md border px-3 py-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="text-sm font-semibold">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="space-y-5">
        <Panel title="Controls" description="Ownership, timeline, and project context.">
          <div className="space-y-4">
            <Field label="Priority" icon={<Flag className="size-3.5" />}>
              <Select
                value={priority || undefined}
                onValueChange={onPriorityChange}
                disabled={pending}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="Set priority">
                    {(value: string) =>
                      TASK_PRIORITY_META[value as TaskPriority]?.label ?? 'Set priority'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITY_ORDER.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_META[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Due date" icon={<CalendarDays className="size-3.5" />}>
              <Input
                type="date"
                value={due}
                onChange={(e) => onDueChange(e.target.value)}
                disabled={pending}
              />
            </Field>

            <Field label="Workstream" icon={<Layers3 className="size-3.5" />}>
              <Select value={areaId} onValueChange={onAreaChange} disabled={pending}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      areas.find((a) => a.id === value)?.name ?? String(value)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {projects.length > 0 && (
              <Field label="Linked project" icon={<BriefcaseBusiness className="size-3.5" />}>
                <Select
                  value={projectId || '__none'}
                  onValueChange={onProjectChange}
                  disabled={pending}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue>
                      {(value: string) => {
                        const project = projects.find((p) => p.id === value);
                        if (!project || value === '__none') return 'No linked project';
                        return project.client?.name
                          ? `${project.name} - ${project.client.name}`
                          : project.name;
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No linked project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.client?.name ? `${p.name} - ${p.client.name}` : p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
        </Panel>

        <Panel title="Assignees" description="People accountable for the next move.">
          {assignees.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              No one assigned yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {assignees.map((a) => (
                <li key={a.user_id} className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
                  <UserAvatar
                    email={a.user_id}
                    name={a.profile?.full_name ?? 'Unknown'}
                    avatarUrl={a.profile?.avatar_url}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {a.profile?.full_name ?? a.user_id}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${a.profile?.full_name ?? 'assignee'}`}
                    disabled={pending}
                    onClick={() =>
                      run(() => removeAssignee(task.id, a.user_id), 'Assignee removed', {
                        refresh: true,
                      })
                    }
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <AssigneePicker
              existingIds={assignees.map((a) => a.user_id)}
              onAdd={(userId) =>
                run(() => addAssignee(task.id, userId), 'Assignee added', {
                  refresh: true,
                })
              }
            />
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-start gap-2 border-b border-border px-4 py-3">
        <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
