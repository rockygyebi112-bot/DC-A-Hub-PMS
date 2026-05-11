import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listPortalProjects } from "@/lib/portal/queries";
import { listSearchableActivities } from "@/lib/search";
import { getNotificationFeed } from "@/lib/notifications/queries";
import { NotificationsBell } from "@/components/notifications/notifications-bell";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [projects, notifications, activities] = await Promise.all([
    listPortalProjects().catch(() => []),
    getNotificationFeed("portal").catch(() => ({
      entries: [],
      unreadCount: 0,
      lastReadAt: null,
    })),
    listSearchableActivities().catch(() => []),
  ]);

  // Clients only ever care about their own projects, so we don't surface
  // an "All projects" overview link in the portal sidebar — for single-
  // project clients it would just bounce them back to the same page.
  const groups = [
    {
      group: "Your projects",
      items: projects.slice(0, 8).map((p) => ({
        href: `/portal/projects/${p.id}`,
        label: p.name,
        icon: "folder-kanban" as const,
      })),
    },
  ].filter((g) => g.items.length > 0);

  const projectBrands = Object.fromEntries(
    projects.map((p) => [
      p.id,
      { name: p.client?.name ?? p.name, logoUrl: p.client?.logo_url ?? null },
    ]),
  );

  // Search must see EVERY project the user can reach, not just the first
  // 8 we render in the sidebar — otherwise typing the name of project #9
  // returns "no matches".
  const searchItems = [
    ...projects.map((p) => ({
      href: `/portal/projects/${p.id}`,
      label: p.name,
      group: "Your projects",
    })),
    ...activities.map((a) => ({
      href: `/portal/projects/${a.project_id}/activities/${a.id}`,
      label: a.name,
      group: `Activity · ${a.project_name}`,
    })),
  ];

  return (
    <AppShell
      brand="DC&A Hub"
      subtitle="Client Portal"
      groups={groups}
      storageKey="portal-sidebar-collapsed"
      defaultLogoUrl="/logo.png"
      projectBrands={projectBrands}
      projectPathPrefix="/portal/projects"
      searchItems={searchItems}
      showBreadcrumbs={false}
      user={{ name: profile.fullName, email: profile.email, avatarUrl: profile.avatarUrl }}
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
