import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/admin/forms/project-form";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { archiveProject, restoreProject } from "@/lib/admin/actions/projects";
import { getProject, listClients } from "@/lib/admin/queries";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, clients] = await Promise.all([
    getProject(id),
    listClients({ includeArchived: true }),
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
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={project.name}
        subtitle={`${project.code} / ${project.client?.name ?? "No client"}`}
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
              render={<Link href={`/admin/projects/${id}/team`} />}
            >
              <Users className="size-4" />
              Team
            </Button>
            <Button variant="ghost" size="sm" render={<Link href="/admin/projects" />}>
              Back
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
