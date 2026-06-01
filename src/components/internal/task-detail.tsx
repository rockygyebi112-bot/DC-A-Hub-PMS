'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X } from 'lucide-react';

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
import { SectionCard } from '@/components/admin/ui/section-card';
import { UserAvatar } from '@/components/admin/ui/user-avatar';
import { cn } from '@/lib/utils';
import {
  TASK_PRIORITY_ORDER,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
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

type ActionFn = () => Promise<{ ok: boolean; error?: string }>;

export function TaskDetail({
  task,
  areas,
}: {
  task: Task;
  areas: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // Optimistic local copies so edits feel instant; reverted if the action fails.
  const [status, setStatus] = useState<TaskStatus>(task.status as TaskStatus);
  const [priority, setPriority] = useState(task.priority ?? '');
  const [due, setDue] = useState(task.due_date ?? '');
  const [areaId, setAreaId] = useState(task.area_id);

  /** Run a server action with toast feedback (and an optional optimistic revert). */
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

  function onStatusChange(value: string | null) {
    const next = (value ?? status) as TaskStatus;
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
    run(() => updateTask(task.id, patch({ area_id: next })), 'Area updated', {
      refresh: true,
      onError: () => setAreaId(prev),
    });
  }

  const assignees = (task.assignees ?? []).filter((a) => a.profile);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main: description */}
      <div className="space-y-6 lg:col-span-2">
        <SectionCard title="Description">
          <form
            action={(fd) => run(() => updateTask(task.id, fd), 'Description saved')}
            className="space-y-3"
          >
            <Textarea
              name="description"
              defaultValue={task.description ?? ''}
              rows={8}
              placeholder="Add a description, context, or links…"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={pending}>
                Save description
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>

      {/* Sidebar: details + assignees */}
      <div className="space-y-6">
        <SectionCard title="Details">
          <div className="space-y-4">
            <Field label="Status">
              <Select value={status} onValueChange={onStatusChange} disabled={pending}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue>
                    {(value: string) => {
                      const meta = TASK_STATUS_META[value as TaskStatus];
                      return meta ? (
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className={cn('size-2 rounded-full', meta.dot)}
                          />
                          {meta.label}
                        </span>
                      ) : (
                        value
                      );
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={cn('size-2 rounded-full', TASK_STATUS_META[s].dot)}
                        />
                        {TASK_STATUS_META[s].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Priority">
              <Select
                value={priority || undefined}
                onValueChange={onPriorityChange}
                disabled={pending}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="Set priority">
                    {(value: string) =>
                      TASK_PRIORITY_META[value as TaskPriority]?.label ??
                      'Set priority'
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

            <Field label="Due date">
              <Input
                type="date"
                value={due}
                onChange={(e) => onDueChange(e.target.value)}
                disabled={pending}
              />
            </Field>

            <Field label="Area">
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
          </div>
        </SectionCard>

        <SectionCard title="Assignees">
          {assignees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one assigned yet.</p>
          ) : (
            <ul className="space-y-2">
              {assignees.map((a) => (
                <li key={a.user_id} className="flex items-center gap-2">
                  <UserAvatar
                    email={a.user_id}
                    name={a.profile?.full_name ?? 'Unknown'}
                    avatarUrl={a.profile?.avatar_url}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
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
          <AssigneePicker
            existingIds={assignees.map((a) => a.user_id)}
            onAdd={(userId) =>
              run(() => addAssignee(task.id, userId), 'Assignee added', {
                refresh: true,
              })
            }
          />
        </SectionCard>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
