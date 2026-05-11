"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/admin/ui/theme-toggle";
import { UserDropdown } from "@/components/admin/ui/user-dropdown";
import { Breadcrumbs } from "@/components/admin/ui/breadcrumbs";
import { TopbarSearch, type SearchItem } from "./topbar-search";
import type { NavGroup } from "./app-sidebar";
import { cn } from "@/lib/utils";

export function AppTopbar({
  name,
  email,
  avatarUrl,
  showSearch = true,
  extra,
  greeting,
  greetingSubtitle,
  greetingPath,
  mobileNav,
  searchGroups,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  showSearch?: boolean;
  extra?: ReactNode;
  /** When set AND current pathname === greetingPath, a personalised greeting replaces the breadcrumbs. */
  greeting?: string;
  greetingSubtitle?: string;
  greetingPath?: string;
  /** Mobile-only nav trigger rendered at the left of the topbar (e.g. hamburger). */
  mobileNav?: ReactNode;
  /** Sidebar groups whose items power the search dropdown. */
  searchGroups?: NavGroup[];
}) {
  const pathname = usePathname();
  const showGreeting = !!greeting && (!greetingPath || pathname === greetingPath);
  const searchItems = useMemo<SearchItem[]>(() => {
    if (!searchGroups) return [];
    return searchGroups.flatMap((group) =>
      group.items.map((item) => ({
        href: item.href,
        label: item.label,
        group: group.group,
      })),
    );
  }, [searchGroups]);
  return (
    <header
      className={cn(
        "topbar-glass sticky top-0 z-20 border-b",
        // Respect the iOS notch / dynamic island on mobile.
        "pt-[env(safe-area-inset-top)]",
      )}
    >
      <div className="flex h-[68px] items-center gap-2 px-3 md:gap-3 md:px-6">
        {mobileNav}
        {/* Mobile: when a greeting is shown, hide the inline slot so the row
            collapses to just the hamburger + right-side icons. The full
            greeting renders on its own row below for breathing room. */}
        <div
          className={cn(
            "min-w-0 flex-1 overflow-hidden",
            showGreeting && "hidden sm:block",
          )}
        >
          {showGreeting ? (
            <div className="topbar-greeting">
              <h1 className="truncate">{greeting}</h1>
              {greetingSubtitle && <p className="truncate">{greetingSubtitle}</p>}
            </div>
          ) : (
            <Breadcrumbs />
          )}
        </div>
        {/* Push right-side icons to the edge on mobile when greeting row is split out. */}
        {showGreeting && <div className="flex-1 sm:hidden" aria-hidden />}
        {showSearch && searchItems.length > 0 && (
          /* Desktop only: live-search dropdown over the user's projects. */
          <div className="hidden md:block">
            <TopbarSearch items={searchItems} />
          </div>
        )}
        <div className="flex items-center gap-1 md:gap-2">
          {extra}
          <ThemeToggle />
          <UserDropdown name={name} email={email} avatarUrl={avatarUrl} />
        </div>
      </div>
      {showGreeting && (
        <div className="topbar-greeting border-t border-border/60 px-4 pb-2 pt-1.5 sm:hidden">
          <h1>{greeting}</h1>
          {greetingSubtitle && <p>{greetingSubtitle}</p>}
        </div>
      )}
    </header>
  );
}
