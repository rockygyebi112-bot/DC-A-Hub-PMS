import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ArchiveToggle } from "@/components/admin/archive-toggle";
import { FilterChips } from "@/components/admin/ui/filter-chips";
import { ListSearch } from "@/components/admin/ui/list-search";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { ProjectsTable, type ProjectsTableRow } from "@/components/admin/ui/projects-table";
import { listProjects } from "@/lib/admin/queries";

const STATUS_OPTIONS = [
  { value: "planning", label: "Not started" },
  { value: "active", label: "Ongoing" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Done" },
];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const includeArchived = sp.archived === "1";
  const q = (sp.q ?? "").toLowerCase().trim();
  const status = sp.status ?? "";
  const allRows = await listProjects({ includeArchived });
  const rows = allRows.filter((p) => {
    if (q) {
      const haystack = `${p.name} ${p.code} ${p.client?.name ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (status && p.status !== status) return false;
    return true;
  });

  // Live status counts (computed from search-matched rows so chip counts
  // reflect what's actually navigable from the current view).
  const statusSource = q
    ? allRows.filter((p) => {
        const haystack = `${p.name} ${p.code} ${p.client?.name ?? ""}`.toLowerCase();
        return haystack.includes(q);
      })
    : allRows;
  const statusCounts: Record<string, number> = {
    planning: 0,
    active: 0,
    paused: 0,
    completed: 0,
  };
  for (const p of statusSource) {
    if (p.status in statusCounts) statusCounts[p.status] += 1;
  }

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
        description={`${rows.length} shown from ${allRows.length} loaded`}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={q || status ? "No projects match" : "No projects yet"}
            description={
              q || status
                ? "Adjust search, status filters, or include archived projects."
                : "Create a project shell once its client exists."
            }
            action={
              !q &&
              !status && (
                <Button render={<Link href="/admin/projects/new" />}>
                  <Plus className="size-4" />
                  New project
                </Button>
              )
            }
          />
        ) : (
          <ProjectsTable rows={rows as ProjectsTableRow[]} />
        )}
      </SectionCard>
    </div>
  );
}
