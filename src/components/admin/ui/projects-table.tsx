"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function ProjectsTable({ rows }: { rows: ProjectsTableRow[] }) {
  const router = useRouter();
  return (
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
