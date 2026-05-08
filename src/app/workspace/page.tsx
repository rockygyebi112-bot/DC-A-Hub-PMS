import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { ProjectProgress } from "@/components/workspace/project-progress";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listWorkspaceProjects } from "@/lib/workspace/queries";

export default async function WorkspaceHome() {
  const [profile, projects] = await Promise.all([
    getCurrentProfile(),
    listWorkspaceProjects(),
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
      <PageHeader
        title="Workspace"
        subtitle={`Signed in as ${profile?.fullName ?? "unknown"}. Build workplans and complete project activities.`}
      />

      {projects.length === 0 ? (
        <SectionCard>
          <EmptyState
            variant="page"
            icon={FolderKanban}
            title="No assigned projects"
            description="Ask an admin to add you to a project team."
          />
        </SectionCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/workspace/projects/${project.id}`}
              className="rounded-[var(--admin-card-radius)] border bg-card p-5 shadow-sm transition-colors hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{project.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {project.client?.name ?? "No client"} / {project.code}
                  </p>
                </div>
                <StatusPill status={project.status as "planning" | "active" | "paused" | "completed"} />
              </div>
              <div className="mt-5">
                <ProjectProgress done={project.doneCount} total={project.totalCount} />
              </div>
              <Button className="mt-5" variant="outline" size="sm">
                <Plus className="size-4" />
                Open workplan
              </Button>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
