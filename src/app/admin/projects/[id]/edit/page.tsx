import Link from "next/link";
import { Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/admin/forms/project-form";
import { ProjectWorkplanPanel } from "@/components/admin/project-workplan-panel";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { archiveProject, restoreProject } from "@/lib/admin/actions/projects";
import { getProject, listClients } from "@/lib/admin/queries";
import { listProjectPhases } from "@/lib/workspace/queries";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, clients, phases] = await Promise.all([
    getProject(id),
    listClients({ includeArchived: true }),
    listProjectPhases(id),
  ]);

  async function archive() {
    "use server";
    await archiveProject(id);
  }

  async function restore() {
    "use server";
    await restoreProject(id);
  }

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title={`Edit ${project.name}`}
        subtitle={`${project.code} / ${project.client?.name ?? "No client"}`}
        backFallbackHref={`/admin/projects/${id}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              status={
                project.archived_at
                  ? "archived"
                  : (project.status as "planning" | "active" | "paused" | "completed")
              }
            />
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/admin/projects/${id}`} />}
            >
              <Eye className="size-4" />
              Overview
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/admin/projects/${id}/team`} />}
            >
              <Users className="size-4" />
              Team
            </Button>
          </div>
        }
      />

      <ProjectForm
        mode="edit"
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          id: project.id,
          name: project.name,
          code: project.code,
          client_id: project.client_id,
          status: project.status as "planning" | "active" | "paused" | "completed",
          description: project.description ?? "",
          start_date: project.start_date ?? "",
          end_date: project.end_date ?? "",
        }}
      />

      <ProjectWorkplanPanel projectId={id} phases={phases} />

      <SectionCard
        title="Danger zone"
        description="Archived projects are hidden from non-admin users and workspace queries."
        tone="destructive"
      >
        <form action={project.archived_at ? restore : archive}>
          <Button
            type="submit"
            variant={project.archived_at ? "default" : "destructive"}
          >
            {project.archived_at ? "Restore project" : "Archive project"}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
