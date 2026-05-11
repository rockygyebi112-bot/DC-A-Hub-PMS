import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ActivityStatus } from "@/components/workspace/status-badge";
import { ProofAccessButton } from "@/components/workspace/proof-access-button";
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
        backFallbackHref={`/portal/projects/${id}`}
        action={
          <ActivityStatus status={activity.status} />
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <SectionCard
          title={activity.status === "done" ? "Completion notes" : "Activity details"}
          description={
            activity.status === "in_progress"
              ? "This activity is currently in progress."
              : activity.status === "not_started"
                ? "This activity has not started yet."
                : undefined
          }
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Responsible</dt>
              <dd className="mt-1 text-sm">{activity.responsible ?? "Not assigned"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Planned date</dt>
              <dd className="mt-1 text-sm">{activity.planned_date ?? "Not scheduled"}</dd>
            </div>
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
          </dl>
          <div className="mt-6 rounded-lg border bg-background p-4">
            <p className="text-sm whitespace-pre-wrap">
              {activity.narrative_note || activity.description || "No narrative has been added yet."}
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Proofs">
          {proofs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No proofs uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {proofs.map((proof) => (
                <ProofAccessButton
                  key={proof.id}
                  proofId={proof.id}
                  fileName={proof.file_name}
                  caption={proof.caption}
                  kind={proof.kind}
                  hint={proof.kind === "link" ? proof.url : proof.mime_type}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
