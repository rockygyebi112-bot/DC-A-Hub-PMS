'use client';

import type { ReactNode } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Flag,
  Save,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  addAssignee,
  removeAssignee,
  setTaskStatus,
  updateTask,
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
import { UserAvatar } from '@/components/admin/ui/user-avatar';
import { cn } from '@/lib/utils';
import {
  TASK_PRIORITY_META,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  asTaskStatus,
  type TaskPriority,
  type TaskStatus,
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
  created_at?: string | null;
  updated_at?: string | null;
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
    run(() => updateTask(task.id, patch({ area_id: next })), 'Section updated', {
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
  const isDone = status === 'done';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onStatusChange(isDone ? 'not_started' : 'done')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
            isDone
              ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600'
              : 'border-border bg-card text-foreground hover:border-emerald-500 hover:text-emerald-600',
          )}
        >
          <CheckCircle2 className="size-4" />
          {isDone ? 'Completed' : 'Mark complete'}
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-xl border border-border/70 bg-card shadow-sm">
        <header className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Description</h2>
        </header>
        <form
          action={(fd) => run(() => updateTask(task.id, fd), 'Description saved', { refresh: true })}
          className="space-y-4 p-5"
        >
          <Textarea
            id="task-description"
            name="description"
            defaultValue={task.description ?? ''}
            rows={12}
            placeholder="Add a description..."
            className="min-h-72 resize-y border-0 bg-muted/30 p-4 text-sm leading-6 shadow-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={pending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Save className="size-3.5" />
              Save
            </Button>
          </div>
        </form>
      </section>

      <aside className="space-y-5">
        <section className="rounded-xl border border-border/70 bg-card px-4 py-5 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Properties</h2>
          <div className="mt-4 space-y-4">
            <Property label="Status">
              <Select
                value={status}
                onValueChange={(value) => value && onStatusChange(value)}
                disabled={pending}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue>
                    {(value: string) => TASK_STATUS_META[value as TaskStatus]?.label ?? 'Set status'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_ORDER.map((item) => {
                    const meta = TASK_STATUS_META[item];
                    return (
                      <SelectItem key={item} value={item}>
                        <span className="inline-flex items-center gap-2">
                          <span className={cn('size-2 rounded-full', meta.dot)} />
                          {meta.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </Property>

            <Property label="Priority">
              <Select value={priority || undefined} onValueChange={onPriorityChange} disabled={pending}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="Set priority">
                    {(value: string) => TASK_PRIORITY_META[value as TaskPriority]?.label ?? 'Set priority'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITY_ORDER.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="inline-flex items-center gap-2">
                        <Flag className="size-3.5" />
                        {TASK_PRIORITY_META[p].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Property>

            <Property label="Due date">
              <Input
                type="date"
                value={due}
                onChange={(e) => onDueChange(e.target.value)}
                disabled={pending}
              />
            </Property>

            <Property label="Section">
              <Select value={areaId} onValueChange={onAreaChange} disabled={pending}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue>
                    {(value: string) => areas.find((a) => a.id === value)?.name ?? String(value)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2 rounded-full bg-muted-foreground/50"
                          style={a.color ? { backgroundColor: a.color } : undefined}
                        />
                        {a.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Property>

            {projects.length > 0 && (
              <Property label="Linked project">
                <Select value={projectId || '__none'} onValueChange={onProjectChange} disabled={pending}>
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
              </Property>
            )}

            <Property label="Assignees">
              <div className="space-y-3">
                {assignees.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {assignees.map((a) => (
                      <span
                        key={a.user_id}
                        className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-muted/30 py-1 pl-1 pr-2 text-xs"
                      >
                        <UserAvatar
                          email={a.user_id}
                          name={a.profile?.full_name ?? 'Unknown'}
                          avatarUrl={a.profile?.avatar_url}
                          size="sm"
                        />
                        <span className="max-w-28 truncate">{a.profile?.full_name ?? a.user_id}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${a.profile?.full_name ?? 'assignee'}`}
                          disabled={pending}
                          onClick={() =>
                            run(() => removeAssignee(task.id, a.user_id), 'Assignee removed', {
                              refresh: true,
                            })
                          }
                          className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
                    No assignees yet.
                  </p>
                )}
                <div className="rounded-lg border border-border/70 bg-card p-2">
                  <AssigneePicker
                    existingIds={assignees.map((a) => a.user_id)}
                    onAdd={(userId) =>
                      run(() => addAssignee(task.id, userId), 'Assignee added', {
                        refresh: true,
                      })
                    }
                  />
                </div>
              </div>
            </Property>

            <Property label="Timeline">
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p>Created {relativeDate(task.created_at) ?? 'recently'}</p>
                <p>Updated {relativeDate(task.updated_at) ?? 'recently'}</p>
              </div>
            </Property>
          </div>
        </section>
      </aside>
      </div>
    </div>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function relativeDate(value?: string | null): string | null {
  if (!value) return null;
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return null;
  const diff = Date.now() - then.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
