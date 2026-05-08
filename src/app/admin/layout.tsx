import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminCounts } from "@/lib/admin/queries";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const counts = await getAdminCounts();

  return (
    <AdminShell
      counts={counts}
      user={{ name: profile.fullName, email: profile.email }}
    >
      {children}
    </AdminShell>
  );
}
