"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown } from "lucide-react";
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
    <>
      {/* Mobile: card list. */}
      <ul className="space-y-2 md:hidden">
        {rows.map((p) => {
          const href = `/admin/projects/${p.id}`;
          return (
            <li key={p.id} className="row-cv-card">
              <Link
                href={href}
                className={`flex min-h-16 flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors active:bg-muted/60 ${
                  p.archived_at ? "opacity-60" : ""
                }`}
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
                      status={
                        p.archived_at
                          ? "archived"
                          : (p.status as
                              | "planning"
                              | "active"
                              | "paused"
                              | "completed")
                      }
                    />
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    {p.code}
                  </code>
                  <span className="truncate">
                    {p.start_date || p.end_date
                      ? `${p.start_date ?? "TBD"} \u2013 ${p.end_date ?? "TBD"}`
                      : "Not scheduled"}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Desktop: table. */}
      <div className="hidden overflow-x-auto md:block">
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
                className={`row-cv cursor-pointer hover:bg-muted/40 transition-colors ${
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
    </>
  );
}
