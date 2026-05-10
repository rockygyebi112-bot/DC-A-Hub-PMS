import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ArchiveToggle } from "@/components/admin/archive-toggle";
import { InviteUserForm } from "@/components/admin/forms/invite-user-form";
import { FilterChips } from "@/components/admin/ui/filter-chips";
import { ListSearch } from "@/components/admin/ui/list-search";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { UsersTable, type UsersTableRow } from "@/components/admin/ui/users-table";
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
          <UsersTable rows={rows as UsersTableRow[]} />
        )}
      </SectionCard>
    </div>
  );
}
