import { redirect } from "next/navigation";
import { FolderKanban, LayoutDashboard } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listPortalProjects } from "@/lib/portal/queries";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const projects = await listPortalProjects().catch(() => []);

  const groups = [
    {
      group: "Portal",
      items: [
        { href: "/portal", label: "All projects", icon: LayoutDashboard, exact: true },
      ],
    },
    {
      group: "Your projects",
      items: projects.slice(0, 8).map((p) => ({
        href: `/portal/projects/${p.id}`,
        label: p.name,
        icon: FolderKanban,
      })),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <AppShell
      brand="DC&A Hub"
      subtitle="Client Portal"
      groups={groups}
      storageKey="portal-sidebar-collapsed"
      user={{ name: profile.fullName, email: profile.email }}
    >
      {children}
    </AppShell>
  );
}
