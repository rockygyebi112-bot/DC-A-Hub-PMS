"use client";

import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/admin/ui/theme-toggle";
import { UserDropdown } from "@/components/admin/ui/user-dropdown";
import { Breadcrumbs } from "@/components/admin/ui/breadcrumbs";
import { TopbarSearch, type SearchItem } from "./topbar-search";
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
  searchItems,
  searchActivityHrefBase = "/workspace",
  showBreadcrumbs = true,
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
  /** Items powering the search dropdown. */
  searchItems?: SearchItem[];
  /** Base path used when navigating to activity matches in the search
   *  dropdown. Defaults to `/workspace`; portal-facing shells pass `/portal`. */
  searchActivityHrefBase?: "/workspace" | "/portal";
  /** Hide the path-based breadcrumb trail (e.g. for client-facing surfaces). */
  showBreadcrumbs?: boolean;
}) {
  // Greeting props kept on the API for callsite compatibility but no longer
  // rendered - the Linear/Notion-restrained topbar surfaces breadcrumbs only.
  void greeting;
  void greetingSubtitle;
  void greetingPath;
  const items = searchItems ?? [];
  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b border-border bg-background/80",
        "supports-[backdrop-filter]:backdrop-blur-md",
        // Respect the iOS notch / dynamic island on mobile.
        "pt-[env(safe-area-inset-top)]",
      )}
    >
      <div className="flex h-14 items-center gap-2 px-3 md:gap-3 md:px-6">
        {mobileNav}
        <div className="min-w-0 flex-1 overflow-hidden">
          {showBreadcrumbs ? <Breadcrumbs /> : null}
        </div>
        {showSearch && items.length > 0 && (
          /* Desktop only: live-search dropdown over the user's projects. */
          <div className="hidden md:block">
            <TopbarSearch items={items} activityHrefBase={searchActivityHrefBase} />
          </div>
        )}
        <div className="flex items-center gap-1 md:gap-2">
          {extra}
          <ThemeToggle />
          <UserDropdown name={name} email={email} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  );
}
