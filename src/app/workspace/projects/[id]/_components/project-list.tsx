import Link from "next/link";
import { ClipboardList, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { DeleteConfirm } from "@/components/workspace/delete-confirm";
import { deleteActivity, deletePhase } from "@/lib/workspace/actions";
import type { WorkspaceActivity, WorkspacePhase } from "@/lib/workspace/queries";

/**
 * "List" tab: a phases summary card on top, then a flat activity table.
 * Both sections support per-row delete via the shared DeleteConfirm.
 */
export function ProjectList({
  projectId,
  phases,
  activities,
}: {
  projectId: string;
  phases: WorkspacePhase[];
  activities: (WorkspaceActivity & { phaseName: string })[];
}) {
  if (activities.length === 0) {
    return (
      <SectionCard>
        <EmptyState
          icon={ClipboardList}
          title="No activities"
          description="Add activities to the workplan."
        />
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {phases.length > 0 && (
        <SectionCard title="Phases" description={`${phases.length} phases in this workplan`}>
          <ul className="divide-y">
            {phases.map((phase) => (
              <li
                key={phase.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{phase.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {phase.activities.length} activities
                    {phase.start_date || phase.end_date
                      ? ` · ${phase.start_date ?? "TBD"} – ${phase.end_date ?? "TBD"}`
                      : ""}
                  </p>
                </div>
                <DeleteConfirm
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete phase"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  }
                  title="Delete phase"
                  description={
                    <>
                      Delete <strong>{phase.name}</strong> and its{" "}
                      <strong>{phase.activities.length} activities</strong>? Documents will be deleted too.
                    </>
                  }
                  confirmWord={phase.activities.length > 0 ? "DELETE" : undefined}
                  action={async () => {
                    "use server";
                    return deletePhase(phase.id);
                  }}
                />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start date</TableHead>
                <TableHead>End date</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => (
                <TableRow key={activity.id} style={{ height: "var(--admin-row-h)" }}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/workspace/projects/${projectId}/activities/${activity.id}`}
                        className="font-medium hover:underline"
                      >
                        {activity.name}
                      </Link>
                      {activity.visibility === "internal" && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          Internal
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{activity.phaseName}</TableCell>
                  <TableCell>
                    <ActivityStatus status={activity.status} />
                  </TableCell>
                  <TableCell>{activity.planned_date ?? "—"}</TableCell>
                  <TableCell>{activity.completed_date ?? "—"}</TableCell>
                  <TableCell>{activity.proofCount}</TableCell>
                  <TableCell className="text-right">
                    <DeleteConfirm
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Delete activity">
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      title="Delete activity"
                      description={
                        <>
                          Delete <strong>{activity.name}</strong>? This will remove all documents uploaded to it.
                        </>
                      }
                      action={async () => {
                        "use server";
                        return deleteActivity(activity.id);
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
