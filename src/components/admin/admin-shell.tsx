import type { ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./ui/admin-topbar";
import type { AdminCounts } from "@/lib/admin/queries";

export function AdminShell({
  children,
  counts,
  user,
  greeting,
  greetingSubtitle,
  notificationCount,
}: {
  children: ReactNode;
  counts: AdminCounts;
  user: { name: string; email: string };
  greeting?: string;
  greetingSubtitle?: string;
  notificationCount?: number;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AdminSidebar counts={counts} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          name={user.name}
          email={user.email}
          greeting={greeting}
          greetingSubtitle={greetingSubtitle}
          notificationCount={notificationCount}
        />
        <main className="flex-1 pb-[calc(var(--mobile-bottom-nav-h)+1rem)] md:pb-0">
          <div className="page-enter mx-auto w-full max-w-[1280px] px-4 py-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
