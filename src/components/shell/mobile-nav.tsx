"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandChip } from "./brand-chip";
import { SidebarNavList } from "./sidebar-nav-list";
import type { NavGroup, ProjectBrand } from "./nav-utils";

/**
 * Mobile navigation drawer.
 *
 * Renders a hamburger button (the caller mounts it in the topbar's
 * mobile-only slot). Tapping it opens a left-slide panel containing the
 * same nav groups as the desktop sidebar. The drawer auto-closes on
 * route change so users never see stale state after navigating.
 */
export function MobileNav({
  brand,
  subtitle,
  groups,
  defaultLogoUrl,
  projectBrands,
  projectPathPrefix,
  footer,
}: {
  brand: string;
  subtitle?: string;
  groups: NavGroup[];
  defaultLogoUrl?: string;
  projectBrands?: Record<string, ProjectBrand>;
  projectPathPrefix?: string;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [openState, setOpenState] = useState({ open: false, pathname: "" });

  // Auto-close on route change so the drawer doesn't linger after navigation.
  const open = openState.pathname === pathname ? openState.open : false;
  function setOpen(nextOpen: boolean) {
    setOpenState({ open: nextOpen, pathname });
  }

  // Honor the same project-brand override as the desktop sidebar so the
  // header in the drawer reflects the active project context.
  const activeProject = (() => {
    if (!projectPathPrefix || !projectBrands) return null;
    if (!pathname.startsWith(projectPathPrefix + "/")) return null;
    const rest = pathname.slice(projectPathPrefix.length + 1);
    const projectId = rest.split("/")[0];
    return projectBrands[projectId] ?? null;
  })();

  const displayBrand = activeProject?.name ?? brand;
  const displayLogo = activeProject?.logoUrl ?? defaultLogoUrl ?? null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open navigation menu"
            className="md:hidden"
          >
            <Menu className="size-5" />
          </Button>
        }
      />

      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm",
            "data-open:animate-in data-open:fade-in-0",
            "data-closed:animate-out data-closed:fade-out-0",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "sidebar-navy fixed inset-y-0 left-0 z-50 flex w-[min(82vw,320px)] flex-col",
            "border-r border-border outline-none",
            // Slide-from-left transitions.
            "data-open:animate-in data-open:slide-in-from-left data-open:duration-200",
            "data-closed:animate-out data-closed:slide-out-to-left data-closed:duration-150",
            // iOS safe-area awareness so the close button isn't behind the notch.
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          )}
        >
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <BrandChip logoUrl={displayLogo} label={displayBrand} />
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title
                className="font-heading text-sm font-bold tracking-tight leading-tight text-white break-words [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
                title={displayBrand}
              >
                {displayBrand}
              </DialogPrimitive.Title>
              {subtitle && (
                <p className="mt-0.5 truncate text-[10px] font-medium tracking-wide text-white/60">
                  {subtitle}
                </p>
              )}
            </div>
            <DialogPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close navigation menu"
                  className="text-white/70 hover:bg-white/5 hover:text-white"
                >
                  <X className="size-4" />
                </Button>
              }
            />
          </div>

          <div className="mt-2 min-h-0 flex-1 overflow-y-auto pb-4">
            <SidebarNavList groups={groups} onNavigate={() => setOpen(false)} />
          </div>

          {footer && <div className="mx-3 mb-3 mt-2 shrink-0">{footer}</div>}

          {/* Bottom brand chip — mirrors the desktop rail. */}
          <div className="flex shrink-0 items-center gap-2 border-t border-white/10 px-4 py-3">
            <BrandChip logoUrl={defaultLogoUrl ?? null} label={brand} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-heading truncate text-xs font-semibold text-white">
                {brand}
              </p>
              <p className="text-[10px] text-white/50">Powered by DC&A Hub</p>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
