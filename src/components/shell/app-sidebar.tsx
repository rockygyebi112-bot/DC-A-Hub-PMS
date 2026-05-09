"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  Users,
  Building2,
  Activity,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// Icons must be referenced by string name (not component) when crossing
// the Server -> Client component boundary, since RSC cannot serialize functions.
export type IconName =
  | "layout-dashboard"
  | "folder-kanban"
  | "list-checks"
  | "users"
  | "building-2"
  | "activity"
  | "calendar-days"
  | "check-circle-2"
  | "clipboard-list"
  | "file-text"
  | "settings";

const ICONS: Record<IconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "folder-kanban": FolderKanban,
  "list-checks": ListChecks,
  users: Users,
  "building-2": Building2,
  activity: Activity,
  "calendar-days": CalendarDays,
  "check-circle-2": CheckCircle2,
  "clipboard-list": ClipboardList,
  "file-text": FileText,
  settings: Settings,
};

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
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
        "sidebar-navy sticky top-0 hidden h-screen shrink-0 border-r border-[hsl(225_35%_24%)] transition-[width] duration-200 md:flex md:flex-col",
        collapsed ? "w-16" : "w-[var(--sidebar-width,240px)]",
      )}
    >
      <div
        className={cn(
          "px-3 pt-4 pb-3",
          collapsed
            ? "flex flex-col items-center gap-2"
            : "flex items-center gap-3 px-4",
        )}
      >
        <div className="flex size-10 shrink-0 items-center justify-center">
          {displayLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayLogo}
              alt={`${displayBrand} logo`}
              className="h-10 w-10 object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-dca-blue-500)] to-[var(--color-dca-cyan-400)] text-white">
              <Sparkles className="size-4" />
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="font-heading truncate text-base font-bold tracking-tight leading-tight text-white">
              {displayBrand}
            </p>
            {displaySubtitle && (
              <p className="truncate text-[10px] font-medium tracking-wide text-white/60">{displaySubtitle}</p>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            "h-7 w-7 text-white/70 hover:bg-white/5 hover:text-white",
            !collapsed && "ml-auto",
          )}
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
              const Icon = ICONS[item.icon] ?? LayoutDashboard;

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
                  <span className="flex size-5 shrink-0 items-center justify-center">
                    <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 1.75} />
                  </span>
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge != null && (
                        <span className={cn(
                          "rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums",
                          active ? "bg-white/20 text-white" : "bg-white/10 text-white/70",
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
