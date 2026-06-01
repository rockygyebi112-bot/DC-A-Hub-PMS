"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { cn } from "@/lib/utils";

export type ClientsTableRow = {
  id: string;
  name: string;
  contact_email: string | null;
  archived_at: string | null;
  project_count: number;
};

export function ClientsTable({ rows }: { rows: ClientsTableRow[] }) {
  const columns: ColumnDef<ClientsTableRow>[] = [
    { id: "name", header: "Name", primary: true, cell: (c) => c.name },
    {
      id: "email",
      header: "Contact email",
      cell: (c) => c.contact_email ?? "-",
    },
    { id: "projects", header: "Projects", cell: (c) => c.project_count },
    {
      id: "status",
      header: "Status",
      cell: (c) => (
        <StatusPill status={c.archived_at ? "archived" : "active-user"} />
      ),
    },
    {
      id: "open",
      header: "",
      align: "end",
      width: "6rem",
      cell: (c) => (
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/admin/clients/${c.id}`} />}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <DataTable<ClientsTableRow>
      caption="Clients"
      data={rows}
      getRowId={(c) => c.id}
      columns={columns}
      rowHref={(c) => `/admin/clients/${c.id}`}
      rowClassName={(c) =>
        cn("row-cv h-[var(--admin-row-h)]", c.archived_at && "opacity-60")
      }
      empty={{ title: "No clients" }}
      renderCard={(c) => (
        <Link
          href={`/admin/clients/${c.id}`}
          className={cn(
            "flex min-h-16 items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors active:bg-muted/60",
            c.archived_at && "opacity-60",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{c.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {c.contact_email ?? "No contact email"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {c.project_count} {c.project_count === 1 ? "project" : "projects"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusPill status={c.archived_at ? "archived" : "active-user"} />
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </Link>
      )}
    />
  );
}
