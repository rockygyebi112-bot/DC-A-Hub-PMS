"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
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
    <>
      {/* Mobile: card list (one tappable card per row). */}
      <ul className="space-y-2 md:hidden">
        {rows.map((c) => {
          const href = `/admin/clients/${c.id}`;
          return (
            <li key={c.id}>
              <Link
                href={href}
                className={`flex min-h-16 items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors active:bg-muted/60 ${
                  c.archived_at ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.contact_email ?? "No contact email"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.project_count}{" "}
                    {c.project_count === 1 ? "project" : "projects"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill
                    status={c.archived_at ? "archived" : "active-user"}
                  />
                  <ChevronRight className="size-4 text-muted-foreground" />
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
    </>
  );
}
