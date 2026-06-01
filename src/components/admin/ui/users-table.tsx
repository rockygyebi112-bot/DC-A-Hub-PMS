"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { cn } from "@/lib/utils";

export type UsersTableRow = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "staff" | "client";
  is_active: boolean;
};

export function UsersTable({ rows }: { rows: UsersTableRow[] }) {
  const columns: ColumnDef<UsersTableRow>[] = [
    {
      id: "name",
      header: "Name",
      primary: true,
      cell: (u) => (
        <span className="flex items-center gap-2">
          <UserAvatar email={u.email} name={u.full_name} size="sm" />
          <span>{u.full_name}</span>
        </span>
      ),
    },
    { id: "email", header: "Email", cell: (u) => u.email },
    { id: "role", header: "Role", cell: (u) => <StatusPill status={u.role} /> },
    {
      id: "status",
      header: "Status",
      cell: (u) => (
        <StatusPill status={u.is_active ? "active-user" : "inactive-user"} />
      ),
    },
    {
      id: "open",
      header: "",
      align: "end",
      width: "6rem",
      cell: (u) => (
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/admin/users/${u.id}`} />}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <DataTable<UsersTableRow>
      caption="Users"
      data={rows}
      getRowId={(u) => u.id}
      columns={columns}
      rowHref={(u) => `/admin/users/${u.id}`}
      rowClassName={(u) =>
        cn("row-cv h-[var(--admin-row-h)]", !u.is_active && "opacity-60")
      }
      empty={{ title: "No users" }}
      renderCard={(user) => (
        <Link
          href={`/admin/users/${user.id}`}
          className={cn(
            "flex min-h-16 items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors active:bg-muted/60",
            !user.is_active && "opacity-60",
          )}
        >
          <UserAvatar email={user.email} name={user.full_name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{user.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusPill status={user.role} />
            {!user.is_active && <StatusPill status="inactive-user" />}
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}
    />
  );
}
