import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToastForm, type ToastFormResult } from "@/components/ui/toast-form";
import { Card } from "./primitives";
import type { ActivityForView, PhaseOption } from "./types";

export function EditCard({
  save,
  activity,
  phases,
  baseHref,
}: {
  save: (fd: FormData) => Promise<ToastFormResult | void>;
  activity: ActivityForView;
  phases: PhaseOption[];
  baseHref: string;
}) {
  return (
    <Card icon={<Pencil className="size-4" />} title="Edit activity">
      <ToastForm
        action={save}
        successMessage="Activity saved"
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Phase
            <select
              name="phase_id"
              defaultValue={activity.phase_id}
              required
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            >
              {phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Status
            <select
              name="status"
              defaultValue={activity.status}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">Ongoing</option>
              <option value="done">Done</option>
            </select>
          </label>
        </div>
        <label className="grid gap-2 text-sm font-medium">
          Activity name
          <Input name="name" defaultValue={activity.name} required />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Deliverable
          <Input
            name="deliverable"
            placeholder="What concrete output proves this activity is done?"
            defaultValue={activity.deliverable ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Responsible team
          <Input
            name="responsible"
            placeholder="Team member, team, or external partner"
            defaultValue={activity.responsible ?? ""}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Start date
            <Input
              name="planned_date"
              type="date"
              defaultValue={activity.planned_date ?? ""}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            End date
            <Input
              name="completed_date"
              type="date"
              defaultValue={activity.completed_date ?? ""}
            />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-medium">
          Notes / dependencies
          <Textarea
            name="description"
            defaultValue={activity.description ?? ""}
            placeholder="Anything the team needs to know — prerequisites, references, links."
            rows={4}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Completion narrative
          <Textarea
            name="narrative_note"
            defaultValue={activity.narrative_note ?? ""}
            placeholder="Shown to the client in the portal once the activity is marked done."
            rows={5}
          />
        </label>
        <div className="flex items-center gap-2">
          <Button type="submit">Save activity</Button>
          <Button variant="outline" render={<Link href={baseHref} />}>
            Cancel
          </Button>
        </div>
      </ToastForm>
    </Card>
  );
}
