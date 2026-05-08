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
    items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true }],
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
          "sticky top-0 hidden h-screen shrink-0 border-r bg-sidebar transition-[width] duration-200 md:flex md:flex-col",
          collapsed ? "w-16" : "w-[var(--sidebar-width,240px)]",
        )}
      >
        <div className="flex h-[var(--topbar-height,58px)] items-center gap-2.5 border-b px-3">
          <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="DC&A Hub logo" className="h-7 w-7 object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-heading truncate text-sm font-bold tracking-tight">DC&amp;A Hub PMS</p>
              <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Admin Console</p>
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
                      "flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-sm transition-colors-smooth",
                      collapsed && "justify-center px-0",
                      active
                        ? "sidebar-item-active bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-[26px] shrink-0 items-center justify-center rounded-[7px] transition-smooth",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/60 text-muted-foreground",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    {!collapsed && (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {typeof count === "number" && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 font-mono text-[10px]",
                              active
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground",
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
          <div className="mt-auto mx-3 mb-3 rounded-[10px] bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="text-xs font-semibold text-foreground">Operations snapshot</p>
            <p className="mt-1">
              {counts.activeProjects} ongoing projects across {counts.activeClients} clients.
            </p>
          </div>
        )}
      </aside>

      <nav className="mobile-nav fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 rounded-2xl border border-border/60 p-1 shadow-card-elevated md:hidden">
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
