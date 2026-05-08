import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArchiveToggle } from "@/components/admin/archive-toggle";
import { InviteUserForm } from "@/components/admin/forms/invite-user-form";
import { FilterChips } from "@/components/admin/ui/filter-chips";
import { ListSearch } from "@/components/admin/ui/list-search";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { listUsers } from "@/lib/admin/queries";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
  { value: "client", label: "Client" },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; q?: string; role?: string }>;
}) {
  const sp = await searchParams;
  const includeInactive = sp.archived === "1";
  const q = (sp.q ?? "").toLowerCase().trim();
  const roleFilter = sp.role ?? "";
  const allRows = await listUsers({ includeInactive });
  const rows = allRows.filter((user) => {
    if (q && !`${user.full_name} ${user.email}`.toLowerCase().includes(q)) {
      return false;
    }
    if (roleFilter && user.role !== roleFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Admins, staff, and client viewers with access to the platform."
        action={<InviteUserForm />}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ListSearch placeholder="Search users..." />
          <ArchiveToggle label="Show inactive" />
        </div>
        <FilterChips paramName="role" options={ROLE_OPTIONS} />
      </div>

      <SectionCard
        title="User directory"
        description={`${rows.length} shown from ${allRows.length} loaded`}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q || roleFilter ? "No users match" : "No users yet"}
            description={
              q || roleFilter
                ? "Adjust your search or role filter."
                : "Invite staff and client viewers when they need access."
            }
          />
        ) : (
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
                {rows.map((user) => (
                  <TableRow
                    key={user.id}
                    className={!user.is_active ? "opacity-60" : ""}
                    style={{ height: "var(--admin-row-h)" }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar email={user.email} name={user.full_name} size="sm" />
                        <span className="font-medium">{user.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <StatusPill status={user.role as "admin" | "staff" | "client"} />
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        status={user.is_active ? "active-user" : "inactive-user"}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/admin/users/${user.id}`} />}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
