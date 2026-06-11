'use client';

import type { ComponentProps, ReactNode } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { createTask } from '@/lib/internal/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  TASK_PRIORITY_META,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  type TaskPriority,
  type TaskStatus,
} from './task-meta';
import { AssigneePicker } from './assignee-picker';

export function NewTaskForm({
  areas,
  projects = [],
  defaultStatus = 'not_started',
  defaultAreaId,
  triggerLabel = 'New task',
  triggerVariant = 'default',
  triggerSize = 'default',
  triggerClassName,
}: {
  areas: { id: string; name: string }[];
  projects?: { id: string; name: string; client?: { name: string } | null }[];
  defaultStatus?: TaskStatus;
  defaultAreaId?: string;
  triggerLabel?: string;
  triggerVariant?: ComponentProps<typeof Button>['variant'];
  triggerSize?: ComponentProps<typeof Button>['size'];
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [priority, setPriority] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  function reset() {
    setPriority('');
    setProjectId('');
    setAssigneeIds([]);
  }

  function onSubmit(fd: FormData) {
    start(async () => {
      const r = await createTask(fd);
      if (!r.ok) {
        toast.error(r.error ?? 'Could not create task');
        return;
      }
      toast.success('Task created');
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant={triggerVariant}
            size={triggerSize}
            className={cn(
              triggerVariant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90',
              triggerClassName,
            )}
          >
            <Plus className="size-4" />
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent className="sm:inset-y-0 sm:right-0 sm:left-auto sm:top-0 sm:h-dvh sm:max-h-dvh sm:w-full sm:max-w-lg sm:translate-x-0 sm:translate-y-0 sm:overflow-y-auto sm:rounded-none sm:rounded-l-2xl sm:p-0">
        <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle className="text-lg font-semibold">Create task</DialogTitle>
        </DialogHeader>

        <form action={onSubmit} className="space-y-5 px-6 py-5">
          <Input
            id="new-task-title"
            name="title"
            required
            placeholder="Task name"
            className="h-12 border-0 bg-muted/30 px-0 text-lg font-semibold shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
          />

          <Textarea
            id="new-task-desc"
            name="description"
            rows={3}
            placeholder="Add a description..."
            className="resize-none bg-muted/30"
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Section">
              <Select name="area_id" required defaultValue={defaultAreaId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose section">
                    {(value: string) => areas.find((a) => a.id === value)?.name ?? 'Choose section'}
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
            </FormField>

            <FormField label="Status">
              <Select name="status" defaultValue={defaultStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => TASK_STATUS_META[value as TaskStatus]?.label ?? 'Status'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS_ORDER.map((status) => (
                    <SelectItem key={status} value={status}>
                      {TASK_STATUS_META[status].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Priority">
              <input type="hidden" name="priority" value={priority} />
              <Select
                value={priority || '__none'}
                onValueChange={(v) => setPriority(v === '__none' ? '' : (v ?? ''))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      value && value !== '__none'
                        ? TASK_PRIORITY_META[value as TaskPriority]?.label
                        : 'No priority'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No priority</SelectItem>
                  {TASK_PRIORITY_ORDER.map((item) => (
                    <SelectItem key={item} value={item}>
                      {TASK_PRIORITY_META[item].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Due date">
              <Input id="new-task-due" name="due_date" type="date" />
            </FormField>

            {projects.length > 0 && (
              <FormField label="Linked project">
                <input type="hidden" name="project_id" value={projectId} />
                <Select
                  value={projectId || '__none'}
                  onValueChange={(v) => setProjectId(v === '__none' ? '' : (v ?? ''))}
                >
                  <SelectTrigger className="w-full">
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
              </FormField>
            )}
          </div>

          <FormField label="Assignees">
            {assigneeIds.map((id) => (
              <input key={id} type="hidden" name="assignee_ids" value={id} />
            ))}
            {assigneeIds.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {assigneeIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-1 text-xs"
                  >
                    {id}
                    <button
                      type="button"
                      aria-label="Remove assignee"
                      onClick={() => setAssigneeIds((prev) => prev.filter((item) => item !== id))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <AssigneePicker
              existingIds={assigneeIds}
              onAdd={(id) => setAssigneeIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
            />
          </FormField>

          <DialogFooter className="sm:-mx-6 sm:-mb-5 sm:mt-8">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {pending ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
