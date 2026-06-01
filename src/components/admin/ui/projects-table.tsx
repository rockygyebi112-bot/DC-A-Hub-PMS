"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  DataTable,
  type ColumnDef,
  type SortState,
} from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { cn } from "@/lib/utils";

export type ProjectsTableRow = {
  id: string;
  name: string;
  code: string;
  status: "planning" | "active" | "paused" | "completed";
  archived_at: string | null;
  start_date: string | null;
  end_date: string | null;
  client: { id: string; name: string } | null;
};

type ProjectStatus = ProjectsTableRow["status"];

function scheduleText(p: ProjectsTableRow, dash: string): string {
  return p.start_date || p.end_date
    ? `${p.start_date ?? "TBD"} ${dash} ${p.end_date ?? "TBD"}`
    : "Not scheduled";
}

export function ProjectsTable({ rows }: { rows: ProjectsTableRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Sorting is server-driven via ?sort=&dir= — the rows arrive pre-ordered, so
  // the table reflects the sort but never re-orders on the client (manualSort).
  const sortKey = params.get("sort");
  const sort: SortState | null = sortKey
    ? { columnId: sortKey, direction: params.get("dir") === "desc" ? "desc" : "asc" }
    : null;

  function onSortChange(next: SortState) {
    const qp = new URLSearchParams(Array.from(params.entries()));
    qp.set("sort", next.columnId);
    qp.set("dir", next.direction);
    const qs = qp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const columns: ColumnDef<ProjectsTableRow>[] = [
    { id: "name", header: "Name", primary: true, sortable: true, cell: (p) => p.name },
    {
      id: "code",
      header: "Code",
      cell: (p) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{p.code}</code>
      ),
    },
    {
      id: "client_id",
      header: "Client",
      sortable: true,
      cell: (p) => p.client?.name ?? "-",
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (p) => (
        <StatusPill
          status={p.archived_at ? "archived" : (p.status as ProjectStatus)}
        />
      ),
    },
    {
      id: "start_date",
      header: "Start date",
      sortable: true,
      cellClassName: "text-muted-foreground",
      cell: (p) => scheduleText(p, "-"),
    },
    {
      id: "open",
      header: "",
      align: "end",
      width: "6rem",
      cell: (p) => (
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/admin/projects/${p.id}`} />}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <DataTable<ProjectsTableRow>
      caption="Projects"
      data={rows}
      getRowId={(p) => p.id}
      columns={columns}
      manualSort
      sort={sort}
      onSortChange={onSortChange}
      rowHref={(p) => `/admin/projects/${p.id}`}
      rowClassName={(p) =>
        cn("row-cv h-[var(--admin-row-h)]", p.archived_at && "opacity-60")
      }
      empty={{ title: "No projects" }}
      renderCard={(p) => (
        <Link
          href={`/admin/projects/${p.id}`}
          className={cn(
            "flex min-h-16 flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors active:bg-muted/60",
            p.archived_at && "opacity-60",
          )}
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {p.client?.name ?? "Unassigned"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusPill
                status={p.archived_at ? "archived" : (p.status as ProjectStatus)}
              />
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              {p.code}
            </code>
            <span className="truncate">{scheduleText(p, "–")}</span>
          </div>
        </Link>
      )}
    />
  );
}
