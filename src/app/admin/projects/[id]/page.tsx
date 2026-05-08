import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "@/components/admin/forms/project-form";
import { getProject, listClients } from "@/lib/admin/queries";
import {
  archiveProject,
  restoreProject,
} from "@/lib/admin/actions/projects";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [p, clients] = await Promise.all([
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
    <div className="space-y-6">
      <div>
        <Link href="/admin/projects" className="text-sm text-muted-foreground hover:underline">
          ← Back to projects
        </Link>
        <div className="flex items-baseline gap-3 mt-2">
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <code className="text-muted-foreground">{p.code}</code>
        </div>
        <div className="mt-2">
          <Link
            href={`/admin/projects/${id}/team`}
            className="text-sm underline"
          >
            Manage team →
          </Link>
        </div>
      </div>

      <ProjectForm
        mode="edit"
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          id: p.id,
          name: p.name,
          code: p.code,
          client_id: p.client_id,
          status: p.status as "planning" | "active" | "paused" | "completed",
          description: p.description ?? "",
          start_date: p.start_date ?? "",
          end_date: p.end_date ?? "",
        }}
      />

      <div className="border-t pt-6">
        <h2 className="text-lg font-medium">Danger zone</h2>
        <form action={p.archived_at ? restore : archive} className="mt-4">
          <Button type="submit" variant={p.archived_at ? "default" : "destructive"}>
            {p.archived_at ? "Restore project" : "Archive project"}
          </Button>
        </form>
      </div>
    </div>
  );
}
