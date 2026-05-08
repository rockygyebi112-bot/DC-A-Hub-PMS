import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArchiveToggle } from "@/components/admin/archive-toggle";
import { FilterChips } from "@/components/admin/ui/filter-chips";
import { ListSearch } from "@/components/admin/ui/list-search";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { listProjects } from "@/lib/admin/queries";

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
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
        <FilterChips paramName="status" options={STATUS_OPTIONS} />
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow
                    key={p.id}
                    className={p.archived_at ? "opacity-60" : ""}
                    style={{ height: "var(--admin-row-h)" }}
                  >
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {p.code}
                      </code>
                    </TableCell>
                    <TableCell>{p.client?.name ?? "-"}</TableCell>
                    <TableCell>
                      <StatusPill
                        status={
                          p.archived_at
                            ? "archived"
                            : (p.status as "planning" | "active" | "paused" | "completed")
                        }
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.start_date || p.end_date
                        ? `${p.start_date ?? "TBD"} - ${p.end_date ?? "TBD"}`
                        : "Not scheduled"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/admin/projects/${p.id}`} />}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
