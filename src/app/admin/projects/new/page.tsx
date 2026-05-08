import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/admin/forms/project-form";
import { PageHeader } from "@/components/admin/ui/page-header";
import { listClients } from "@/lib/admin/queries";

export default async function NewProjectPage() {
  const clients = await listClients();

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="New project"
        subtitle="Create a project shell and connect it to a client."
        action={
          <Button variant="ghost" size="sm" render={<Link href="/admin/projects" />}>
            Back to projects
          </Button>
        }
      />
      <ProjectForm
        mode="create"
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
