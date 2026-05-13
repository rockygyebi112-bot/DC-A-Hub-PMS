import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { SidebarBrandCard } from "@/components/admin/ui/sidebar-brand-card";
import { getAdminLayoutData } from "@/lib/admin/queries";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getCachedNotificationFeed } from "@/lib/notifications/queries";

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
  // PERF: profile + layout + notifications all read from Supabase
  // independently. Running them in parallel removes ~2 sequential
  // round-trips from the TTFB critical path on every page navigation.
  // The loaders are wrapped in React `cache()` so any duplicate calls
  // from nested pages are still deduped within the same request.
  const [profile, layout, notifications] = await Promise.all([
    getCurrentProfile(),
    getAdminLayoutData("").catch(() => null),
    getCachedNotificationFeed("", "workspace").catch(() => ({
      entries: [],
      unreadCount: 0,
      lastReadAt: null,
    })),
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
