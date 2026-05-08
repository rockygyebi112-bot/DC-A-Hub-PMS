import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { getPortalActivity } from "@/lib/portal/queries";

export default async function PortalActivityPage({
  params,
}: {
  params: Promise<{ id: string; activityId: string }>;
}) {
  const { id, activityId } = await params;
  const { activity, proofs } = await getPortalActivity(activityId);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title={activity.name}
        subtitle={`${activity.phase?.project?.name ?? "Project"} / ${activity.phase?.name ?? "Phase"}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ActivityStatus status={activity.status} />
            <Button variant="ghost" size="sm" render={<Link href={`/portal/projects/${id}`} />}>
              Back to project
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <SectionCard title="Completion notes">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Completed date</dt>
              <dd className="mt-1 text-sm">{activity.completed_date ?? "Not marked complete"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Participants</dt>
              <dd className="mt-1 text-sm">{activity.participants_count ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Location</dt>
              <dd className="mt-1 text-sm">{activity.location ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Planned date</dt>
              <dd className="mt-1 text-sm">{activity.planned_date ?? "Not scheduled"}</dd>
            </div>
          </dl>
          <div className="mt-6 rounded-lg border bg-background p-4">
            <p className="text-sm whitespace-pre-wrap">
              {activity.narrative_note || activity.description || "No narrative has been added yet."}
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Proof downloads" description="Links expire after one hour.">
          {proofs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No proofs uploaded"
              description="Proof files will appear here when DC&A Hub uploads them."
            />
          ) : (
            <div className="space-y-2">
              {proofs.map((proof) => (
                <a
                  key={proof.id}
                  href={proof.signedUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border bg-background p-3 text-sm transition-colors hover:bg-accent"
                >
                  <span className="font-medium">{proof.file_name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {proof.caption ?? proof.mime_type ?? "Proof file"}
                  </span>
                </a>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

