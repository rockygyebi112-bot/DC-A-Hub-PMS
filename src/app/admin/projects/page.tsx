import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ArchiveToggle } from "@/components/admin/archive-toggle";
import { FilterChips } from "@/components/admin/ui/filter-chips";
import { ListPagination } from "@/components/admin/ui/list-pagination";
import { ListSearch } from "@/components/admin/ui/list-search";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ProjectsTable, type ProjectsTableRow } from "@/components/admin/ui/projects-table";
import {
  countProjects,
  getProjectsStatusCounts,
  listProjects,
} from "@/lib/admin/queries";
import { computePageInfo, DEFAULT_PAGE_SIZE, parsePage } from "@/lib/pagination";

const STATUS_OPTIONS = [
  { value: "planning", label: "Not started" },
  { value: "active", label: "Ongoing" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Done" },
];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    archived?: string;
    q?: string;
    status?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const includeArchived = sp.archived === "1";
  const search = (sp.q ?? "").trim();
  const status = sp.status ?? "";
  const sort = sp.sort;
  const dir: "asc" | "desc" = sp.dir === "desc" ? "desc" : "asc";

  // Server-side pagination — the previous implementation fetched every
  // project then filtered in JS, which fell over past ~2k rows. Push the
  // page slice + filters into Postgres and only ship the visible window.
  const pageSize = DEFAULT_PAGE_SIZE;
  const requestedPage = parsePage(sp.page);
  const totalCount = await countProjects({
    includeArchived,
    search: search || undefined,
    status: status || undefined,
  });
  const pageInfo = computePageInfo(requestedPage, totalCount, pageSize);

  const [rows, statusCounts] = await Promise.all([
    listProjects({
      includeArchived,
      search: search || undefined,
      status: status || undefined,
      sort,
      dir,
      limit: pageInfo.pageSize,
      offset: pageInfo.offset,
    }),
    // Status-chip counts are scoped to the current search but ignore the
    // active status filter so chips stay clickable across all values.
    getProjectsStatusCounts({
      includeArchived,
      search: search || undefined,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Delivery shells, status, scheduling, and team access."
        action={
          <Button render={<Link href="/admin/projects/new" />}>
            <Plus className="size-4" />
            New project
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ListSearch placeholder="Search projects..." />
          <ArchiveToggle />
        </div>
        <FilterChips paramName="status" options={STATUS_OPTIONS} counts={statusCounts} />
      </div>

      <SectionCard
        title="Project roster"
        description={`${totalCount.toLocaleString()} matching`}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={search || status ? "No projects match" : "No projects yet"}
            description={
              search || status
                ? "Adjust search, status filters, or include archived projects."
                : "Create a project shell once its client exists."
            }
            action={
              !search &&
              !status && (
                <Button render={<Link href="/admin/projects/new" />}>
                  <Plus className="size-4" />
                  New project
                </Button>
              )
            }
          />
        ) : (
          <>
            <ProjectsTable rows={rows as ProjectsTableRow[]} />
            <ListPagination info={pageInfo} />
          </>
        )}
      </SectionCard>
    </div>
  );
}
