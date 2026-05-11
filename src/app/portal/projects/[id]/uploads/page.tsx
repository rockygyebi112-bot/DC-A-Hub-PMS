import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui/page-header";
import { PortalProjectTabs } from "@/components/portal/project-tabs";
import { UploadsGate } from "@/components/portal/uploads-gate";
import { countProjectDocuments, getPortalProject } from "@/lib/portal/queries";

export default async function PortalProjectUploadsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [project, totalCount] = await Promise.all([
    getPortalProject(id),
    countProjectDocuments(id),
  ]);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        backFallbackHref={`/portal/projects/${project.id}`}
        title={`${project.name} · Uploads`}
        subtitle="Confidential documents shared with you on this project."
      />
      <PortalProjectTabs projectId={project.id} />
      <UploadsGate projectId={project.id} totalCount={totalCount} />
    </div>
  );
}
