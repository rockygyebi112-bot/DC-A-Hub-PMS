import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, Field, Muted } from "./primitives";

export function DetailsCard({
  activity,
  showResponsible,
}: {
  activity: { deliverable: string | null; responsible: string | null };
  showResponsible: boolean;
}) {
  return (
    <Card icon={<FileText className="size-4" />} title="Activity details">
      <dl
        className={cn(
          "-mx-5 -my-4 grid divide-y divide-border sm:divide-y-0",
          showResponsible && "sm:grid-cols-2 sm:divide-x",
        )}
      >
        <Field label="Deliverable">
          {activity.deliverable ?? <Muted text="Not specified" />}
        </Field>
        {showResponsible && (
          <Field label="Responsible team">
            {activity.responsible ?? <Muted text="Not assigned" />}
          </Field>
        )}
      </dl>
    </Card>
  );
}
