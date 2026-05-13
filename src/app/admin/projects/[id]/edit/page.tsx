import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/admin/forms/project-form";
import { ProjectWorkplanPanel } from "@/components/admin/project-workplan-panel";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { DeleteConfirm } from "@/components/workspace/delete-confirm";
import {
  archiveProject,
  deleteProject,
  restoreProject,
} from "@/lib/admin/actions/projects";
import { getProject, listClients } from "@/lib/admin/queries";
import { listProjectPhases } from "@/lib/workspace/queries";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [projectMaybe, clients, phases] = await Promise.all([
    getProject(id),
    listClients({ includeArchived: true }),
    listProjectPhases(id),
  ]);
  if (!projectMaybe) notFound();
  const project = projectMaybe;

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
        description="Archive hides the project. Delete permanently removes it and all phases, activities, documents, and budgets — this cannot be undone."
        tone="destructive"
      >
        <div className="flex flex-wrap items-center gap-2">
          <form action={project.archived_at ? restore : archive}>
            <Button
              type="submit"
              variant={project.archived_at ? "default" : "outline"}
            >
              {project.archived_at ? "Restore project" : "Archive project"}
            </Button>
          </form>
          <DeleteConfirm
            trigger={
              <Button variant="destructive">
                <Trash2 className="size-4" />
                Delete project
              </Button>
            }
            title="Delete project"
            description={
              <>
                This will permanently delete <strong>{project.name}</strong> and
                every phase, activity, document, and budget attached to it. This
                cannot be undone.
              </>
            }
            confirmWord="DELETE"
            confirmLabel="Delete permanently"
            redirectTo="/admin/projects"
            action={async () => {
              "use server";
              return deleteProject(id);
            }}
          />
        </div>
      </SectionCard>
    </div>
  );
}
