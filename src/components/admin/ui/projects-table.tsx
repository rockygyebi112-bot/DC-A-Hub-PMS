"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function SortableHeader({
  label,
  sortKey,
}: {
  label: string;
  sortKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const currentSort = params.get("sort") ?? "";
  const currentDir = params.get("dir") === "desc" ? "desc" : "asc";
  const active = currentSort === sortKey;

  function go() {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (active) {
      // Toggle direction on the active column.
      next.set("sort", sortKey);
      next.set("dir", currentDir === "asc" ? "desc" : "asc");
    } else {
      // Switching column defaults to asc.
      next.set("sort", sortKey);
      next.set("dir", "asc");
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const Icon = active ? (currentDir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={go}
      className={cn(
        "inline-flex items-center gap-1 text-left transition-colors hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span>{label}</span>
      <Icon className={cn("size-3.5", !active && "opacity-60")} />
    </button>
  );
}

export function ProjectsTable({ rows }: { rows: ProjectsTableRow[] }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableHeader label="Name" sortKey="name" />
            </TableHead>
            <TableHead>Code</TableHead>
            <TableHead>
              <SortableHeader label="Client" sortKey="client_id" />
            </TableHead>
            <TableHead>
              <SortableHeader label="Status" sortKey="status" />
            </TableHead>
            <TableHead>
              <SortableHeader label="Start date" sortKey="start_date" />
            </TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => {
            const href = `/admin/projects/${p.id}`;
            return (
              <TableRow
                key={p.id}
                className={`cursor-pointer hover:bg-muted/40 transition-colors ${
                  p.archived_at ? "opacity-60" : ""
                }`}
                style={{ height: "var(--admin-row-h)" }}
                onClick={() => router.push(href)}
              >
                <TableCell className="font-medium">
                  <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline"
                  >
                    {p.name}
                  </Link>
                </TableCell>
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
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={href} />}
                  >
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
