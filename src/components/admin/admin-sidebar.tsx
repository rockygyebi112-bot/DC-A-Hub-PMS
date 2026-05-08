"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  Sparkles,
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

export function AdminSidebar({ counts }: { counts: AdminCounts }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("admin-sidebar-collapsed") === "1");
  }, []);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("admin-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r bg-muted/30 px-3 py-4 transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-[76px]" : "w-64",
      )}
    >
      <div className="mb-5 flex items-center gap-3 px-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">DC&amp;A Hub PMS</p>
            <p className="truncate text-xs text-muted-foreground">Admin Console</p>
          </div>
        )}
      </div>

      <SidebarToggle collapsed={collapsed} onToggle={toggle} />

      <nav className="mt-4 flex flex-col gap-5">
        {NAV.map((group) => (
          <div key={group.group} className="space-y-1">
            {!collapsed && (
              <p className="px-3 pb-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {group.group}
              </p>
            )}
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              const count = item.countKey ? counts[item.countKey] : undefined;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {typeof count === "number" && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
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
        <div className="mt-auto rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Operations snapshot</p>
          <p className="mt-1">
            {counts.activeProjects} active projects across {counts.activeClients} clients.
          </p>
        </div>
      )}
    </aside>
  );
}
