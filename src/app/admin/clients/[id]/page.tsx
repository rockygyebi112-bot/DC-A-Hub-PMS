import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/admin/forms/client-form";
import { getClient } from "@/lib/admin/queries";
import {
  archiveClient,
  restoreClient,
} from "@/lib/admin/actions/clients";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getClient(id);

  async function archive() {
    "use server";
    await archiveClient(id);
  }
  async function restore() {
    "use server";
    await restoreClient(id);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/clients" className="text-sm text-muted-foreground hover:underline">
          ← Back to clients
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{c.name}</h1>
        {c.archived_at && (
          <p className="text-sm text-muted-foreground">
            Archived on {new Date(c.archived_at).toLocaleDateString()}
          </p>
        )}
      </div>

      <ClientForm
        mode="edit"
        initial={{
          id: c.id,
          name: c.name,
          contact_email: c.contact_email ?? "",
          logo_url: c.logo_url ?? "",
        }}
      />

      <div className="border-t pt-6">
        <h2 className="text-lg font-medium">Danger zone</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Archived clients are hidden from non-admin users. Their projects keep running unless archived separately.
        </p>
        <form action={c.archived_at ? restore : archive} className="mt-4">
          <Button type="submit" variant={c.archived_at ? "default" : "destructive"}>
            {c.archived_at ? "Restore client" : "Archive client"}
          </Button>
        </form>
      </div>
    </div>
  );
}
