import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ArchiveToggle } from "@/components/admin/archive-toggle";
import { ListSearch } from "@/components/admin/ui/list-search";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ClientsTable } from "@/components/admin/ui/clients-table";
import { listClients } from "@/lib/admin/queries";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const includeArchived = sp.archived === "1";
  const q = (sp.q ?? "").toLowerCase().trim();
  const allRows = await listClients({ includeArchived });
  const rows = allRows.filter((c) => {
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.contact_email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Organizations, contacts, logos, and project ownership."
        action={
          <Button render={<Link href="/admin/clients/new" />}>
            <Plus className="size-4" />
            New client
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListSearch placeholder="Search clients..." />
        <ArchiveToggle />
      </div>

      <SectionCard
        title="Client directory"
        description={`${rows.length} shown from ${allRows.length} loaded`}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={q ? "No clients match" : "No clients yet"}
            description={
              q
                ? "Adjust your search or include archived clients."
                : "Create a client before adding project shells."
            }
            action={
              !q && (
                <Button render={<Link href="/admin/clients/new" />}>
                  <Plus className="size-4" />
                  New client
                </Button>
              )
            }
          />
        ) : (
          <ClientsTable rows={rows} />
        )}
      </SectionCard>
    </div>
  );
}
