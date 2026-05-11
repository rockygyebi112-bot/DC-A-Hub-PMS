"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ui/theme-toggle";
import { UserDropdown } from "@/components/admin/ui/user-dropdown";
import { Breadcrumbs } from "@/components/admin/ui/breadcrumbs";
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
}) {
  const pathname = usePathname();
  const showGreeting = !!greeting && (!greetingPath || pathname === greetingPath);
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
        {showSearch && (
          /* Desktop only: inline search input. The mobile search icon was a
              placeholder and made the topbar feel crowded next to the greeting,
              notifications, theme toggle and avatar — drop it until search is
              actually wired up. */
          <div className="hidden md:block">
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search projects, tasks, teams..."
                className="h-10 w-[300px] rounded-full border border-border bg-muted/40 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background lg:w-[340px]"
              />
            </label>
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
