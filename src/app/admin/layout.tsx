import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { SidebarBrandCard } from "@/components/admin/ui/sidebar-brand-card";
import { getAdminLayoutData } from "@/lib/admin/queries";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

function timeBasedGreeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // PERF: profile + layout fan out in parallel. Notifications used to be
  // fetched here too (~5 supabase round-trips on every page navigation);
  // the bell is now a self-loading client component that hits
  // /api/notifications/feed once on mount, so the layout no longer pays
  // that cost on the SSR critical path.
  const [profile, layout] = await Promise.all([
    getCurrentProfile(),
    getAdminLayoutData("").catch(() => null),
  ]);
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");
  if (!layout) redirect("/login");
  const { counts, clients, projects, overdueCount } = layout;
  const sidebarClients = clients.map((c) => ({
    id: c.id,
    name: c.name,
    logo_url: c.logo_url ?? null,
  }));
  const projectClientMap: Record<string, string> = {};
  for (const p of projects) {
    const c = (p as { client?: { id?: string } | null }).client;
    if (c?.id) projectClientMap[p.id] = c.id;
  }
  // Seed the breadcrumb provider with the project + client names we already
  // loaded for the sidebar / search. Pages that show deeper UUIDs (phases,
  // activities, users) register their own labels via <SetBreadcrumbLabels>.
  const breadcrumbSeed: Record<string, string> = {};
  for (const p of projects) breadcrumbSeed[p.id] = p.name;
  for (const c of clients) breadcrumbSeed[c.id] = c.name;
  const firstName = profile.fullName.trim().split(/\s+/)[0] || "Admin";
  const greeting = `${timeBasedGreeting()}, ${firstName}`;
  const greetingSubtitle =
    overdueCount > 0
      ? `${overdueCount} ${overdueCount === 1 ? "activity" : "activities"} overdue across your projects.`
      : "All projects are on track today.";

  const groups = [
    {
      group: "Command",
      items: [
        {
          href: "/admin",
          label: "Dashboard",
          icon: "layout-dashboard" as const,
          exact: true,
        },
      ],
    },
    {
      group: "Manage",
      items: [
        {
          href: "/admin/clients",
          label: "Clients",
          icon: "building-2" as const,
          badge: counts.activeClients,
        },
        {
          href: "/admin/projects",
          label: "Projects",
          icon: "folder-kanban" as const,
          badge: counts.activeProjects,
        },
        {
          href: "/admin/users",
          label: "Users",
          icon: "users" as const,
          badge: counts.totalUsers,
        },
      ],
    },
  ];

  return (
    <AppShell
      brand="DC&A Hub"
      subtitle="Admin console"
      groups={groups}
      storageKey="admin-sidebar-collapsed"
      defaultLogoUrl="/logo.png"
      searchItems={[
        ...projects.map((p) => ({
          href: `/admin/projects/${p.id}`,
          label: p.name,
          group: "Projects",
        })),
        ...clients.map((c) => ({
          href: `/admin/clients/${c.id}`,
          label: c.name,
          group: "Clients",
        })),
      ]}
      user={{ name: profile.fullName, email: profile.email, avatarUrl: profile.avatarUrl }}
      sidebarFooter={
        <SidebarBrandCard
          clients={sidebarClients}
          projectClientMap={projectClientMap}
        />
      }
      greeting={greeting}
      greetingSubtitle={greetingSubtitle}
      greetingPath="/admin"
      breadcrumbSeed={breadcrumbSeed}
      topbarExtra={<NotificationsBell surface="workspace" />}
    >
      {children}
    </AppShell>
  );
}
