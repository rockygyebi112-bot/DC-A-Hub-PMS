import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getWorkspaceLayoutData } from "@/lib/workspace/queries";
import { NotificationsBell } from "@/components/notifications/notifications-bell";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // PERF: profile + layout fan out in parallel. Notifications used to be
  // fetched here too (~5 supabase round-trips on every page navigation);
  // the bell is now a self-loading client component, so the layout no
  // longer pays that cost on the SSR critical path.
  const [profile, layoutResult] = await Promise.all([
    getCurrentProfile(),
    getWorkspaceLayoutData("").catch(() => null),
  ]);
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "staff") redirect("/portal");
  const layout = layoutResult ?? { projects: [] };
  const { projects } = layout;

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
      searchItems={projects.map((p) => ({
        href: `/workspace/projects/${p.id}`,
        label: p.name,
        group: "Projects",
      }))}
      user={{ name: profile.fullName, email: profile.email, avatarUrl: profile.avatarUrl }}
      topbarExtra={<NotificationsBell surface="workspace" />}
    >
      {children}
    </AppShell>
  );
}

