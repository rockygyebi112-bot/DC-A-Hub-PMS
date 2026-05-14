import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectIcon } from "@/components/ui/project-icon";
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
    <div>
      <PageHeader
        title="Your projects"
        subtitle={`${profile?.fullName ?? "Welcome"} · live progress from DC&A Hub`}
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
              className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/10 focus-ring"
            >
              <div className="flex items-start gap-3">
                <ProjectIcon name={project.name} seed={project.id} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold group-hover:underline">{project.name}</p>
                    <StatusPill status={project.status as "planning" | "active" | "paused" | "completed"} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{project.code}</p>
                </div>
              </div>
              <div className="mt-5">
                <ProjectProgress done={project.doneCount} total={project.totalCount} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
