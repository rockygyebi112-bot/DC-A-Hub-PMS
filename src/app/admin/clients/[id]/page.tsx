import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, FolderKanban, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientDangerActions } from "@/components/admin/client-danger-actions";
import { ClientForm } from "@/components/admin/forms/client-form";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { ProjectProgress } from "@/components/workspace/project-progress";
import { getClient, listClientProjects } from "@/lib/admin/queries";
import { SetBreadcrumbLabels } from "@/components/shell/breadcrumb-context";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Parallel fetch: the project list and the client row are independent reads.
  // We start both in flight and only branch on `client` after both resolve —
  // the small wasted query in the 404 case is worth the latency win on the
  // happy path where every detail-page render previously paid for serial
  // round-trips.
  const [clientMaybe, projects] = await Promise.all([
    getClient(id),
    listClientProjects(id),
  ]);
  if (!clientMaybe) notFound();
  const client = clientMaybe;

  return (
    <div className="max-w-5xl space-y-6">
      <SetBreadcrumbLabels labels={{ [id]: client.name }} />
      <PageHeader
        title={client.name}
        subtitle={
          client.archived_at
            ? `Archived on ${new Date(client.archived_at).toLocaleDateString()}`
            : "Client profile and contact settings"
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={client.archived_at ? "archived" : "active-user"} />
          </div>
        }
        backFallbackHref="/admin/clients"
      />

      <ClientForm
        mode="edit"
        initial={{
          id: client.id,
          name: client.name,
          contact_email: client.contact_email ?? "",
          logo_url: client.logo_url ?? "",
        }}
      />

      <SectionCard
        title="Projects and checklists"
        description="Each client checklist lives inside one of their projects."
      >
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects for this client"
            description="Create a project before importing a checklist or workplan."
            action={
              <Button render={<Link href="/admin/projects/new" />}>
                New project
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="grid gap-4 rounded-lg border bg-background p-4 lg:grid-cols-[minmax(0,1fr)_260px_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{project.name}</p>
                    <StatusPill
                      status={
                        project.archived_at
                          ? "archived"
                          : (project.status as "planning" | "active" | "paused" | "completed")
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {project.code} / {project.start_date ?? "TBD"} - {project.end_date ?? "TBD"}
                  </p>
                </div>
                <ProjectProgress done={project.doneCount} total={project.totalCount} />
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/admin/projects/${project.id}`} />}
                  >
                    Open
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/workspace/projects/${project.id}`} />}
                  >
                    <ListChecks className="size-4" />
                    Workplan
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/portal/projects/${project.id}`} />}
                  >
                    <Eye className="size-4" />
                    Client view
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Danger zone"
        description="Archived clients are hidden from non-admin users. Their projects are not archived automatically."
        tone="destructive"
      >
        <ClientDangerActions
          clientId={id}
          clientName={client.name}
          archived={!!client.archived_at}
        />
      </SectionCard>
    </div>
  );
}
