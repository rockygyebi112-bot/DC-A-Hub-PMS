"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useSidebar } from "@/lib/sidebar-context";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { desktopCollapsed } = useSidebar();
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className={cn(
          "transition-all duration-300",
          desktopCollapsed ? "lg:ml-16" : "lg:ml-64",
        )}
      >
        <Topbar />
        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10 max-w-[1440px] mx-auto pb-[calc(56px+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
