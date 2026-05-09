import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserRoleSelect } from "@/components/admin/forms/user-role-select";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusPill } from "@/components/admin/ui/status-pill";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { DeleteConfirm } from "@/components/workspace/delete-confirm";
import {
  deactivateUser,
  deleteUser,
  reactivateUser,
  setUserRole,
} from "@/lib/admin/actions/users";
import { getUserByProfileId } from "@/lib/admin/queries";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserByProfileId(id);

  async function changeRole(formData: FormData) {
    "use server";
    const role = formData.get("role")?.toString();
    await setUserRole(id, { role });
  }

  async function deactivate() {
    "use server";
    await deactivateUser(id);
  }

  async function reactivate() {
    "use server";
    await reactivateUser(id);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={user.full_name}
        subtitle={user.email}
        backFallbackHref="/admin/users"
      />

      <div className="flex items-center gap-4 rounded-[var(--admin-card-radius)] border bg-card p-5 shadow-sm">
        <UserAvatar email={user.email} name={user.full_name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{user.full_name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill status={user.role as "admin" | "staff" | "client"} />
            <StatusPill status={user.is_active ? "active-user" : "inactive-user"} />
          </div>
        </div>
      </div>

      <SectionCard
        title="Role"
        description="Determines which surfaces this user can access."
      >
        <form action={changeRole} className="flex max-w-sm items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Global role
            </label>
            <UserRoleSelect
              key={user.role}
              role={user.role as "admin" | "staff" | "client"}
            />
          </div>
          <Button type="submit" variant="secondary">
            Save
          </Button>
        </form>
      </SectionCard>

      <SectionCard
        title="Danger zone"
        description="Deactivating revokes sessions and blocks sign-in. Deleting permanently removes the account from auth and the profile — this cannot be undone."
        tone="destructive"
      >
        <div className="flex flex-wrap items-center gap-2">
          <form action={user.is_active ? deactivate : reactivate}>
            <Button type="submit" variant={user.is_active ? "outline" : "default"}>
              {user.is_active ? "Deactivate user" : "Reactivate user"}
            </Button>
          </form>
          <DeleteConfirm
            trigger={
              <Button variant="destructive">
                <Trash2 className="size-4" />
                Delete user
              </Button>
            }
            title="Delete user"
            description={
              <>
                This will permanently delete <strong>{user.full_name}</strong>{" "}
                ({user.email}) from authentication and remove their profile.
                Their authored history (activities, proofs, comments) will be
                preserved but unattributed. This cannot be undone.
              </>
            }
            confirmWord="DELETE"
            confirmLabel="Delete permanently"
            redirectTo="/admin/users"
            action={async () => {
              "use server";
              return deleteUser(id);
            }}
          />
        </div>
      </SectionCard>
    </div>
  );
}
