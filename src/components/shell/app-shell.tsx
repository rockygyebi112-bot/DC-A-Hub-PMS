import type { ReactNode } from "react";
import { AppSidebar, type NavGroup } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";

export function AppShell({
  children,
  brand,
  subtitle,
  groups,
  storageKey,
  user,
  sidebarFooter,
}: {
  children: ReactNode;
  brand: string;
  subtitle?: string;
  groups: NavGroup[];
  storageKey: string;
  user: { name: string; email: string };
  sidebarFooter?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-muted/30 text-foreground">
      <AppSidebar
        brand={brand}
        subtitle={subtitle}
        groups={groups}
        storageKey={storageKey}
        footer={sidebarFooter}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar name={user.name} email={user.email} />
        <main className="flex-1 animate-in fade-in-0 duration-300">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
