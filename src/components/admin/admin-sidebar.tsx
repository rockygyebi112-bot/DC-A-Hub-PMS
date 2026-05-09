"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { SidebarToggle } from "./ui/sidebar-toggle";
import { SidebarBrandCard } from "./ui/sidebar-brand-card";
import { cn } from "@/lib/utils";
import type { AdminCounts } from "@/lib/admin/queries";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  countKey?: keyof AdminCounts;
};

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Command",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    group: "Manage",
    items: [
      { href: "/admin/clients", label: "Clients", icon: Building2, countKey: "activeClients" },
      { href: "/admin/projects", label: "Projects", icon: FolderKanban, countKey: "activeProjects" },
      { href: "/admin/users", label: "Users", icon: Users, countKey: "totalUsers" },
    ],
  },
];

const SIDEBAR_STORAGE_KEY = "admin-sidebar-collapsed";
const SIDEBAR_STORAGE_EVENT = "admin-sidebar-collapsed-change";

function subscribeToCollapsed(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SIDEBAR_STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SIDEBAR_STORAGE_EVENT, callback);
  };
}

function getCollapsedSnapshot() {
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
}

function getServerCollapsedSnapshot() {
  return false;
}

export function AdminSidebar({ counts }: { counts: AdminCounts }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeToCollapsed,
    getCollapsedSnapshot,
    getServerCollapsedSnapshot,
  );

  function toggle() {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "0" : "1");
    window.dispatchEvent(new Event(SIDEBAR_STORAGE_EVENT));
  }

  function isActive(item: NavItem) {
    return item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <>
      <aside
        className={cn(
          "sidebar-navy sticky top-0 hidden h-screen shrink-0 border-r border-[hsl(225_35%_24%)] transition-[width] duration-200 md:flex md:flex-col",
          collapsed ? "w-16" : "w-[var(--sidebar-width,240px)]",
        )}
      >
        <div className="flex items-center gap-3 px-4 pt-5 pb-4">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/95 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="DC&A Hub logo" className="h-8 w-8 object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-heading truncate text-base font-bold tracking-tight text-white">
                DCA <span className="text-[var(--color-dca-cyan-400)]">&amp;</span> HUB
              </p>
              <p className="truncate text-[10px] font-medium tracking-wide text-white/60">
                Project Management System
              </p>
            </div>
          )}
        </div>

        <div className="px-3 pt-3">

        <SidebarToggle collapsed={collapsed} onToggle={toggle} />
        </div>

        <nav className="mt-4 flex flex-col gap-5 px-3">
          {NAV.map((group) => (
            <div key={group.group} className="space-y-1">
              {!collapsed && (
                <p className="nav-group-label px-3 pb-1">
                  {group.group}
                </p>
              )}
              {group.items.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                const count = item.countKey ? counts[item.countKey] : undefined;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm transition-colors-smooth",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-[var(--color-dca-blue-500)] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                        : "text-white/70 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <span
                      className="flex size-5 shrink-0 items-center justify-center"
                    >
                      <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 1.75} />
                    </span>
                    {!collapsed && (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {typeof count === "number" && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums",
                              active
                                ? "bg-white/20 text-white"
                                : "bg-white/10 text-white/70",
                            )}
                          >
                            {count}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div className="mt-auto px-3 pb-4">
            <SidebarBrandCard />
          </div>
        )}
      </aside>

      <nav className="mobile-nav fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 rounded-2xl border border-border/60 p-1 shadow-card-elevated md:hidden">
        {/* mobile bottom nav stays on light theme for clarity */}
        {NAV.flatMap((group) => group.items).map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[0.65rem] font-semibold transition-colors-smooth",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
