import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { SidebarBrandCard } from "@/components/admin/ui/sidebar-brand-card";
import { getAdminCounts, listClients, listProjects } from "@/lib/admin/queries";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getNotificationFeed } from "@/lib/notifications/queries";

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
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const [counts, notifications, clients, projects] = await Promise.all([
    getAdminCounts(),
    getNotificationFeed("workspace").catch(() => ({
      entries: [],
      unreadCount: 0,
      lastReadAt: null,
    })),
    listClients().catch(() => []),
    listProjects().catch(() => []),
  ]);
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
  const firstName = profile.fullName.trim().split(/\s+/)[0] || "Admin";
  const greeting = `${timeBasedGreeting()}, ${firstName}! 👋`;

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
      user={{ name: profile.fullName, email: profile.email, avatarUrl: profile.avatarUrl }}
      sidebarFooter={
        <SidebarBrandCard
          clients={sidebarClients}
          projectClientMap={projectClientMap}
        />
      }
      greeting={greeting}
      greetingSubtitle="Here's what's happening with your projects today."
      greetingPath="/admin"
      topbarExtra={
        <NotificationsBell
          entries={notifications.entries}
          unreadCount={notifications.unreadCount}
          lastReadAt={notifications.lastReadAt}
        />
      }
    >
      {children}
    </AppShell>
  );
}
