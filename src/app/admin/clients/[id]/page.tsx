import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/admin/forms/client-form";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { archiveClient, restoreClient } from "@/lib/admin/actions/clients";
import { getClient } from "@/lib/admin/queries";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);

  async function archive() {
    "use server";
    await archiveClient(id);
  }

  async function restore() {
    "use server";
    await restoreClient(id);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={client.name}
        subtitle={
          client.archived_at
            ? `Archived on ${new Date(client.archived_at).toLocaleDateString()}`
            : "Client profile and contact settings"
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={client.archived_at ? "archived" : "active"} />
            <Button variant="ghost" size="sm" render={<Link href="/admin/clients" />}>
              Back
            </Button>
          </div>
        }
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
        title="Danger zone"
        description="Archived clients are hidden from non-admin users. Their projects are not archived automatically."
        tone="destructive"
      >
        <form action={client.archived_at ? restore : archive}>
          <Button
            type="submit"
            variant={client.archived_at ? "default" : "destructive"}
          >
            {client.archived_at ? "Restore client" : "Archive client"}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}
