import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listWorkspaceProjects } from "@/lib/workspace/queries";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "staff") redirect("/portal");

  const projects = await listWorkspaceProjects().catch(() => []);
  const activeCount = projects.filter((p) => p.status === "active").length;

  const groups = [
    {
      group: "Workspace",
      items: [
        { href: "/workspace", label: "Dashboard", icon: "layout-dashboard" as const, exact: true },
        {
          href: "/workspace#projects",
          label: "Projects",
          icon: "folder-kanban" as const,
          badge: projects.length || undefined,
        },
      ],
    },
    {
      group: "Quick links",
      items: projects.slice(0, 5).map((p) => ({
        href: `/workspace/projects/${p.id}`,
        label: p.name,
        icon: "list-checks" as const,
      })),
    },
    profile.role === "admin"
      ? {
          group: "Admin",
          items: [{ href: "/admin", label: "Admin console", icon: "users" as const }],
        }
      : { items: [] },
  ].filter((g) => g.items.length > 0);

  const projectBrands = Object.fromEntries(
    projects.map((p) => [
      p.id,
      { name: p.client?.name ?? p.name, logoUrl: p.client?.logo_url ?? null },
    ]),
  );

  return (
    <AppShell
      brand="DC&A Hub"
      subtitle="Workspace"
      groups={groups}
      storageKey="workspace-sidebar-collapsed"
      defaultLogoUrl="/logo.png"
      projectBrands={projectBrands}
      projectPathPrefix="/workspace/projects"
      user={{ name: profile.fullName, email: profile.email }}
      sidebarFooter={
        <div className="rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Operations</p>
          <p className="mt-1">{activeCount} active / {projects.length} projects</p>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}

