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

export type ClientsTableRow = {
  id: string;
  name: string;
  contact_email: string | null;
  archived_at: string | null;
  project_count: number;
};

export function ClientsTable({ rows }: { rows: ClientsTableRow[] }) {
  const router = useRouter();
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact email</TableHead>
            <TableHead>Projects</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => {
            const href = `/admin/clients/${c.id}`;
            return (
              <TableRow
                key={c.id}
                className={`cursor-pointer hover:bg-muted/40 transition-colors ${
                  c.archived_at ? "opacity-60" : ""
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
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>{c.contact_email ?? "-"}</TableCell>
                <TableCell>{c.project_count}</TableCell>
                <TableCell>
                  <StatusPill status={c.archived_at ? "archived" : "active-user"} />
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" render={<Link href={href} />}>
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
