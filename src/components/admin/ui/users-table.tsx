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
    <div className="overflow-x-auto">
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
                className={`cursor-pointer hover:bg-muted/40 transition-colors ${
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
  );
}
