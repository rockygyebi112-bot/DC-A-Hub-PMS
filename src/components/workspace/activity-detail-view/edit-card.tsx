import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToastForm, type ToastFormResult } from "@/components/ui/toast-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
            <Select name="phase_id" defaultValue={activity.phase_id} required>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder="Select a phase" />
              </SelectTrigger>
              <SelectContent>
                {phases.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    {phase.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Status
            <Select name="status" defaultValue={activity.status}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_started">Not started</SelectItem>
                <SelectItem value="in_progress">Ongoing</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
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
            Planned date
            <Input
              name="planned_date"
              type="date"
              defaultValue={activity.planned_date ?? ""}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Actual completion date
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
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-800 dark:text-gray-100">
            Visibility <span className="text-red-600">*</span>
          </legend>
          <p className="text-xs text-gray-500">
            Internal-only activities are hidden from the client portal but visible to admin and assigned staff.
          </p>
          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="visibility"
                value="client_visible"
                required
                defaultChecked={activity.visibility === "client_visible"}
                className="size-4 accent-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              Client-visible
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="visibility"
                value="internal"
                required
                defaultChecked={activity.visibility === "internal"}
                className="size-4 accent-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              Internal only
            </label>
          </div>
        </fieldset>
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
