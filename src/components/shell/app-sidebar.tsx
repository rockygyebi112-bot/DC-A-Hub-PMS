"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: string | number;
};

export type NavGroup = {
  group?: string;
  items: NavItem[];
};

export function AppSidebar({
  brand,
  subtitle,
  groups,
  storageKey,
  footer,
}: {
  brand: string;
  subtitle?: string;
  groups: NavGroup[];
  storageKey: string;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r bg-card px-3 py-4 transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-[76px]" : "w-60",
      )}
    >
      <div className="mb-5 flex items-center gap-3 px-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-sm">
          <Sparkles className="size-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{brand}</p>
            {subtitle && (
              <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto h-7 w-7"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </Button>
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-5 overflow-y-auto">
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-0.5">
            {!collapsed && group.group && (
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.group}
              </p>
            )}
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge != null && (
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                        )}>
                          {item.badge}
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

      {!collapsed && footer && <div className="mt-4">{footer}</div>}
    </aside>
  );
}
