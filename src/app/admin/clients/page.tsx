import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ArchiveToggle } from "@/components/admin/archive-toggle";
import { ListPagination } from "@/components/admin/ui/list-pagination";
import { ListSearch } from "@/components/admin/ui/list-search";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ClientsTable } from "@/components/admin/ui/clients-table";
import { countClients, listClients } from "@/lib/admin/queries";
import { computePageInfo, DEFAULT_PAGE_SIZE, parsePage } from "@/lib/pagination";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const includeArchived = sp.archived === "1";
  const search = (sp.q ?? "").trim();

  // Server-side pagination — see admin/projects/page.tsx for the same
  // rationale. Search and contact_email match are pushed into PostgREST.
  const requestedPage = parsePage(sp.page);
  const totalCount = await countClients({
    includeArchived,
    search: search || undefined,
  });
  const pageInfo = computePageInfo(requestedPage, totalCount, DEFAULT_PAGE_SIZE);
  const rows = await listClients({
    includeArchived,
    search: search || undefined,
    limit: pageInfo.pageSize,
    offset: pageInfo.offset,
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
        description={`${totalCount.toLocaleString()} matching`}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={search ? "No clients match" : "No clients yet"}
            description={
              search
                ? "Adjust your search or include archived clients."
                : "Create a client before adding project shells."
            }
            action={
              !search && (
                <Button render={<Link href="/admin/clients/new" />}>
                  <Plus className="size-4" />
                  New client
                </Button>
              )
            }
          />
        ) : (
          <>
            <ClientsTable rows={rows} />
            <ListPagination info={pageInfo} />
          </>
        )}
      </SectionCard>
    </div>
  );
}
