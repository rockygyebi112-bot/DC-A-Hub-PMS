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
import { UserAvatar } from "@/components/admin/ui/user-avatar";

export type UsersTableRow = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "staff" | "client";
  is_active: boolean;
};

export function UsersTable({ rows }: { rows: UsersTableRow[] }) {
  const router = useRouter();
  return (
    <>
      {/* Mobile: card list. */}
      <ul className="space-y-2 md:hidden">
        {rows.map((user) => {
          const href = `/admin/users/${user.id}`;
          return (
            <li key={user.id} className="row-cv-card">
              <Link
                href={href}
                className={`flex min-h-16 items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors active:bg-muted/60 ${
                  !user.is_active ? "opacity-60" : ""
                }`}
              >
                <UserAvatar
                  email={user.email}
                  name={user.full_name}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{user.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusPill status={user.role} />
                  {!user.is_active && (
                    <StatusPill status="inactive-user" />
                  )}
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
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
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((user) => {
            const href = `/admin/users/${user.id}`;
            return (
              <TableRow
                key={user.id}
                className={`row-cv cursor-pointer hover:bg-muted/40 transition-colors ${
                  !user.is_active ? "opacity-60" : ""
                }`}
                style={{ height: "var(--admin-row-h)" }}
                onClick={() => router.push(href)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <UserAvatar email={user.email} name={user.full_name} size="sm" />
                    <Link
                      href={href}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium hover:underline"
                    >
                      {user.full_name}
                    </Link>
                  </div>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <StatusPill status={user.role} />
                </TableCell>
                <TableCell>
                  <StatusPill status={user.is_active ? "active-user" : "inactive-user"} />
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
