"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavItemActive, NavIcon } from "./nav-utils";
import type { NavGroup, NavItem } from "./nav-utils";

/**
 * iOS-style bottom tab bar shown only below the `md` breakpoint.
 *
 * By default it takes the first four nav items (in order, walking each
 * group) so each shell automatically gets a sensible quick-access bar
 * without per-layout configuration. A layout can override by passing an
 * explicit `items` array if a different selection is needed.
 *
 * The drawer (hamburger) still hosts the full nav, so users have an
 * escape hatch for less-common destinations.
 */
export function BottomNav({
  groups,
  items,
}: {
  groups: NavGroup[];
  items?: NavItem[];
}) {
  const pathname = usePathname();

  const tabs: NavItem[] = (
    items ?? groups.flatMap((g) => g.items)
  ).slice(0, 4);

  if (tabs.length === 0) return null;

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background md:hidden",
        // Respect the iOS home indicator.
        "pb-[env(safe-area-inset-bottom)]",
      )}
      style={{
        // Used by the content padding utility below so child pages can
        // reserve scroll space without hard-coding the height.
        ["--bottom-nav-h" as never]: "var(--mobile-bottom-nav-h, 60px)",
      }}
    >
      <ul
        className="mx-auto flex max-w-screen-sm items-stretch justify-around"
        style={{ height: "var(--mobile-bottom-nav-h, 60px)" }}
      >
        {tabs.map((item) => {
          const active = isNavItemActive(item, pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full min-h-11 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium leading-none transition-colors-smooth focus-ring",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <NavIcon
                  name={item.icon}
                  className="size-[22px]"
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
