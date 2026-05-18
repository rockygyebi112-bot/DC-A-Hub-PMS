"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

// Convenience re-export of the icon map so other shell pieces (bottom nav,
// mobile drawer) can resolve string icon keys without re-declaring the map.
// (NAV_ICONS lives in sidebar-nav-list.tsx to avoid a circular import here.)


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
  const displaySubtitle = subtitle;
  const displayLogo = activeProject?.logoUrl ?? defaultLogoUrl ?? null;

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  }

  return (
    <TooltipProvider delay={100}>
    <aside
      className={cn(
        "sidebar-navy sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border transition-[width] duration-200 md:flex md:flex-col",
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
            <Image
              src={displayLogo}
              alt={`${displayBrand} logo`}
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-dca-blue-500)] to-[var(--color-dca-cyan-400)] text-white">
              <Building2 className="size-4" />
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            {/* Long client names (e.g. "Absa Bank Ghana Limited") should be
                fully readable in the rail. We allow wrapping and clamp to
                two lines so a very long name doesn't push the rest of the
                nav off-screen. `break-words` lets it break mid-word if a
                single token is wider than the rail. */}
            <p
              className="font-heading text-sm font-bold tracking-tight leading-tight text-white break-words [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
              title={displayBrand}
            >
              {displayBrand}
            </p>
            {displaySubtitle && (
              <p className="mt-0.5 truncate text-[10px] font-medium tracking-wide text-white/60">{displaySubtitle}</p>
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
              <p className="px-3 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-white/40">
                {group.group}
              </p>
            )}
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = ICONS[item.icon] ?? LayoutDashboard;

              const linkEl = (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors-smooth focus-ring-inset",
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

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger
                      render={
                        <Link
                          href={item.href}
                          prefetch
                          className={cn(
                            "flex items-center justify-center rounded-md px-0 py-2 text-sm transition-colors-smooth focus-ring-inset",
                            active
                              ? "bg-[var(--color-dca-blue-500)] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                              : "text-white/70 hover:bg-white/5 hover:text-white",
                          )}
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center">
                            <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 1.75} />
                          </span>
                        </Link>
                      }
                    />
                    <TooltipContent side="right" sideOffset={8}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return linkEl;
            })}
          </div>
        ))}
      </nav>

      {!collapsed && footer && <div className="mx-3 mb-3 mt-4">{footer}</div>}

      {/* Bottom brand chip — always shows the workspace owner (DC&A Hub) so
          clients still see who's powering the portal even when the top of
          the rail has switched to their own organisation's logo + name. */}
      <div
        className={cn(
          "mt-auto border-t border-white/10",
          collapsed ? "flex flex-col items-center gap-1 py-3" : "flex items-center gap-2 px-4 py-3",
        )}
      >
        <div className="flex size-10 shrink-0 items-center justify-center">
          {defaultLogoUrl ? (
            <Image
              src={defaultLogoUrl}
              alt={`${brand} logo`}
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-dca-blue-500)] to-[var(--color-dca-cyan-400)] text-white">
              <Building2 className="size-4" />
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-heading truncate text-sm font-semibold text-white">
              {brand}
            </p>
            <p className="text-[10px] text-white/50">Powered by DC&A Hub</p>
          </div>
        )}
      </div>
    </aside>
    </TooltipProvider>
  );
}
