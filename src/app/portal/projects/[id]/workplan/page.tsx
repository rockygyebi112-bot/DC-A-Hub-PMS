import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui/page-header";
import { PortalProjectTabs } from "@/components/portal/project-tabs";
import { PortalWorkplanPhases } from "@/components/portal/workplan-phases";
import { getPortalProjectDetail } from "@/lib/portal/queries";

export default async function PortalProjectWorkplanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detail = await getPortalProjectDetail(id);
  if (!detail) notFound();

  const { project, phases } = detail;
  const totalActivities = phases.reduce((sum, p) => sum + p.activities.length, 0);
  const doneActivities = phases.reduce(
    (sum, p) => sum + p.activities.filter((a) => a.status === "done").length,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        backFallbackHref={`/portal/projects/${project.id}`}
        title={`${project.name} · Workplan`}
        subtitle={`${doneActivities} of ${totalActivities} activities completed across ${phases.length} phase${phases.length === 1 ? "" : "s"}.`}
      />

      <PortalProjectTabs projectId={project.id} />

      <PortalWorkplanPhases projectId={project.id} phases={phases} />
    </div>
  );
}
