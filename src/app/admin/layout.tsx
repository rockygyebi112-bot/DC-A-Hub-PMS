import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminCounts } from "@/lib/admin/queries";
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

  const [counts, notifications] = await Promise.all([
    getAdminCounts(),
    getNotificationFeed("workspace").catch(() => ({
      entries: [],
      unreadCount: 0,
      lastReadAt: null,
    })),
  ]);
  const firstName = profile.fullName.trim().split(/\s+/)[0] || "Admin";
  const greeting = `${timeBasedGreeting()}, ${firstName}! 👋`;

  return (
    <AdminShell
      counts={counts}
      user={{ name: profile.fullName, email: profile.email }}
      greeting={greeting}
      greetingSubtitle="Here's what's happening with your projects today."
      notifications={notifications}
    >
      {children}
    </AdminShell>
  );
}
