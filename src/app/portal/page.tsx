import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { ProjectProgress } from "@/components/workspace/project-progress";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listPortalProjects } from "@/lib/portal/queries";

export default async function PortalHome() {
  const [profile, projects] = await Promise.all([
    getCurrentProfile(),
    listPortalProjects(),
  ]);

  if (projects.length === 1) redirect(`/portal/projects/${projects[0].id}`);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
      <PageHeader
        title="Client portal"
        subtitle={`${profile?.fullName ?? "Client"} / project progress`}
      />

      {projects.length === 0 ? (
        <SectionCard>
          <EmptyState
            variant="page"
            icon={FolderKanban}
            title="No projects available"
            description="Your DC&A Hub contact will invite you when a project is ready."
          />
        </SectionCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/portal/projects/${project.id}`}
              className="rounded-[var(--admin-card-radius)] border bg-card p-5 shadow-sm transition-colors hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{project.name}</p>
                  <p className="text-sm text-muted-foreground">{project.code}</p>
                </div>
                <StatusPill status={project.status as "planning" | "active" | "paused" | "completed"} />
              </div>
              <div className="mt-5">
                <ProjectProgress done={project.doneCount} total={project.totalCount} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
