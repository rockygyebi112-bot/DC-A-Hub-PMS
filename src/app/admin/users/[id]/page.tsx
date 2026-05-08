import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getUserByProfileId } from "@/lib/admin/queries";
import {
  setUserRole,
  deactivateUser,
  reactivateUser,
} from "@/lib/admin/actions/users";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await getUserByProfileId(id);

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
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:underline">
          ← Back to users
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{u.full_name}</h1>
        <p className="text-sm text-muted-foreground">{u.email}</p>
        <div className="mt-2">
          {u.is_active ? (
            <Badge>Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
      </div>

      <form action={changeRole} className="space-y-2 max-w-sm">
        <label className="text-sm font-medium">Global role</label>
        <Select name="role" defaultValue={u.role}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="secondary">
          Save role
        </Button>
      </form>

      <div className="border-t pt-6">
        <h2 className="text-lg font-medium">Danger zone</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Deactivating revokes the user&apos;s sessions and prevents future sign-ins.
        </p>
        <form action={u.is_active ? deactivate : reactivate} className="mt-4">
          <Button type="submit" variant={u.is_active ? "destructive" : "default"}>
            {u.is_active ? "Deactivate user" : "Reactivate user"}
          </Button>
        </form>
      </div>
    </div>
  );
}
