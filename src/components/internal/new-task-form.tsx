'use client';

import type { ComponentProps } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createTask } from '@/lib/internal/actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

export function NewTaskForm({
  areas,
  triggerLabel = 'New task',
  triggerVariant = 'default',
  triggerSize = 'default',
  triggerClassName,
}: {
  areas: { id: string; name: string }[];
  triggerLabel?: string;
  triggerVariant?: ComponentProps<typeof Button>['variant'];
  triggerSize?: ComponentProps<typeof Button>['size'];
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  // Base UI Select has no empty-string item value; use a "__none" sentinel for
  // the trigger and feed the real "" back through a hidden input for submission.
  const [priority, setPriority] = useState('');

  function onSubmit(fd: FormData) {
    start(async () => {
      const r = await createTask(fd);
      if (!r.ok) {
        toast.error(r.error ?? 'Could not create task');
        return;
      }
      toast.success('Task created');
      setOpen(false);
      setPriority('');
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={triggerVariant} size={triggerSize} className={triggerClassName}>
            <Plus />
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Create an internal task for the DC&amp;A Hub team.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Area</Label>
            <Select name="area_id" required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose area…">
                  {(value: string) =>
                    areas.find((a) => a.id === value)?.name ?? 'Choose area…'
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-task-title">Title</Label>
            <Input id="new-task-title" name="title" required placeholder="Task title" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-task-desc">Description</Label>
            <Textarea
              id="new-task-desc"
              name="description"
              rows={3}
              placeholder="Description (optional)"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="min-w-40 flex-1 space-y-1.5">
              <Label>Priority</Label>
              <input type="hidden" name="priority" value={priority} />
              <Select
                value={priority || '__none'}
                onValueChange={(v) => setPriority(v === '__none' ? '' : (v ?? ''))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      value && value !== '__none'
                        ? value.charAt(0).toUpperCase() + value.slice(1)
                        : 'No priority'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-40 flex-1 space-y-1.5">
              <Label htmlFor="new-task-due">Due date</Label>
              <Input id="new-task-due" name="due_date" type="date" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
