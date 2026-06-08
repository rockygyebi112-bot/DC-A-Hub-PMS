"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BrandChip } from "./brand-chip";
import { SidebarNavList } from "./sidebar-nav-list";
import type { NavGroup, ProjectBrand } from "./nav-utils";

// Re-exported so existing import sites (`@/components/shell/app-sidebar`)
// keep working — the canonical definitions now live in nav-utils.ts.
export type { IconName, NavItem, NavGroup, ProjectBrand } from "./nav-utils";

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
          <BrandChip logoUrl={displayLogo} label={displayBrand} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              {/* Long client names (e.g. "Absa Bank Ghana Limited") wrap and
                  clamp to two lines so they stay readable without pushing
                  the nav off-screen. */}
              <p
                className="font-heading text-sm font-bold tracking-tight leading-tight text-white break-words [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
                title={displayBrand}
              >
                {displayBrand}
              </p>
              {subtitle && (
                <p className="mt-0.5 truncate text-[10px] font-medium tracking-wide text-white/60">
                  {subtitle}
                </p>
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
            {collapsed ? (
              <ChevronsRight className="size-4" />
            ) : (
              <ChevronsLeft className="size-4" />
            )}
          </Button>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto">
          <SidebarNavList groups={groups} collapsed={collapsed} />
        </div>

        {!collapsed && footer && <div className="mx-3 mb-3 mt-4">{footer}</div>}

        {/* Bottom brand chip — always shows the workspace owner (DC&A Hub) so
            clients still see who powers the portal even when the top of the
            rail has switched to their own organisation's logo + name. */}
        <div
          className={cn(
            "mt-auto shrink-0 border-t border-white/10",
            collapsed
              ? "flex flex-col items-center gap-1 py-3"
              : "flex items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
        >
          <BrandChip logoUrl={defaultLogoUrl ?? null} label={brand} />
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
