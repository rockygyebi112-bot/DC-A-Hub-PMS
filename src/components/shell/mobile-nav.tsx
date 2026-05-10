"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Menu, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SidebarNavList } from "./sidebar-nav-list";
import type { NavGroup, ProjectBrand } from "./app-sidebar";

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
  const [open, setOpen] = useState(false);

  // Auto-close on route change so the drawer doesn't linger after navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
          />
        }
      >
        <Menu className="size-5" />
      </DialogPrimitive.Trigger>

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
            "border-r border-[hsl(225_35%_24%)] outline-none",
            // Slide-from-left transitions.
            "data-open:animate-in data-open:slide-in-from-left data-open:duration-200",
            "data-closed:animate-out data-closed:slide-out-to-left data-closed:duration-150",
            // iOS safe-area awareness so the close button isn't behind the notch.
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          )}
        >
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
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
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title
                className="font-heading truncate text-base font-bold tracking-tight leading-tight text-white"
              >
                {displayBrand}
              </DialogPrimitive.Title>
              {subtitle && (
                <p className="truncate text-[10px] font-medium tracking-wide text-white/60">
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
                />
              }
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="mt-2 flex-1 overflow-y-auto pb-4">
            <SidebarNavList groups={groups} onNavigate={() => setOpen(false)} />
          </div>

          {footer && <div className="mx-3 mb-3 mt-2">{footer}</div>}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
