import Link from "next/link";
import { ProjectForm } from "@/components/admin/forms/project-form";
import { listClients } from "@/lib/admin/queries";

export default async function NewProjectPage() {
  const clients = await listClients();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/projects" className="text-sm text-muted-foreground hover:underline">
          ← Back to projects
        </Link>
        <h1 className="text-2xl font-semibold mt-2">New project</h1>
      </div>
      <ProjectForm
        mode="create"
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
