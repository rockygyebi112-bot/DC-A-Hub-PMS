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
        "topbar-glass sticky top-0 z-20 flex h-[68px] items-center gap-2 border-b px-3 md:gap-3 md:px-6",
        // Respect the iOS notch / dynamic island on mobile.
        "pt-[env(safe-area-inset-top)]",
      )}
    >
      {mobileNav}
      <div className="min-w-0 flex-1 overflow-hidden">
        {showGreeting ? (
          <div className="topbar-greeting">
            <h1 className="truncate">{greeting}</h1>
            {/* Hide the subtitle below sm so the greeting line doesn't wrap on narrow phones. */}
            {greetingSubtitle && (
              <p className="hidden truncate sm:block">{greetingSubtitle}</p>
            )}
          </div>
        ) : (
          <Breadcrumbs />
        )}
      </div>
      {showSearch && (
        <>
          {/* Desktop: inline search input. */}
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
          {/* Mobile: search icon button (placeholder for future command palette). */}
          <button
            type="button"
            aria-label="Search"
            className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground md:hidden"
          >
            <Search className="size-5" />
          </button>
        </>
      )}
      <div className="flex items-center gap-1 md:gap-2">
        {extra}
        <ThemeToggle />
        <UserDropdown name={name} email={email} avatarUrl={avatarUrl} />
      </div>
    </header>
  );
}
