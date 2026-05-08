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

export type ProjectBrand = {
  name: string;
  logoUrl: string | null;
};

export function AppSidebar({
  brand,
  subtitle,
  groups,
  storageKey,
  footer,
  defaultLogoUrl,
  projectBrands,
  projectPathPrefix,
}: {
  brand: string;
  subtitle?: string;
  groups: NavGroup[];
  storageKey: string;
  footer?: React.ReactNode;
  defaultLogoUrl?: string;
  projectBrands?: Record<string, ProjectBrand>;
  projectPathPrefix?: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  const activeProject = (() => {
    if (!projectPathPrefix || !projectBrands) return null;
    if (!pathname.startsWith(projectPathPrefix + "/")) return null;
    const rest = pathname.slice(projectPathPrefix.length + 1);
    const projectId = rest.split("/")[0];
    return projectBrands[projectId] ?? null;
  })();

  const displayBrand = activeProject?.name ?? brand;
  const displaySubtitle = activeProject ? subtitle : subtitle;
  const displayLogo = activeProject?.logoUrl ?? defaultLogoUrl ?? null;

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
        "sticky top-0 hidden h-screen shrink-0 border-r bg-sidebar transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-16" : "w-[var(--sidebar-width,240px)]",
      )}
    >
      <div className="flex h-[var(--topbar-height,58px)] items-center gap-2.5 border-b px-3">
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 shadow-sm">
          {displayLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayLogo}
              alt={`${displayBrand} logo`}
              className="h-7 w-7 object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-sm">
              <Sparkles className="size-4" />
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="font-heading truncate text-sm font-bold tracking-tight leading-tight">{displayBrand}</p>
            {displaySubtitle && (
              <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{displaySubtitle}</p>
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

      <nav className="mt-3 flex flex-1 flex-col gap-5 overflow-y-auto px-3">
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            {!collapsed && group.group && (
              <p className="nav-group-label px-3 pb-1">
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
                      {item.badge != null && (
                        <span className={cn(
                          "rounded-full px-2 py-0.5 font-mono text-[10px]",
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

      {!collapsed && footer && <div className="mx-3 mb-3 mt-4">{footer}</div>}
    </aside>
  );
}
