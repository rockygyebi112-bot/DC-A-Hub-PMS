"use client";

import { useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ui/theme-toggle";
import { UserDropdown } from "@/components/admin/ui/user-dropdown";
import { Breadcrumbs } from "@/components/admin/ui/breadcrumbs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  searchOrgsHrefBase = "/admin",
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
  /** Base path for project/client matches loaded lazily from
   *  `/api/search/orgs`. Defaults to `/admin`. */
  searchOrgsHrefBase?: "/admin" | "/workspace" | "/portal";
  /** Hide the path-based breadcrumb trail (e.g. for client-facing surfaces). */
  showBreadcrumbs?: boolean;
}) {
  // Greeting props kept on the API for callsite compatibility but no longer
  // rendered - the Linear/Notion-restrained topbar surfaces breadcrumbs only.
  void greeting;
  void greetingSubtitle;
  void greetingPath;
  // Search items are now loaded lazily by TopbarSearch via /api/search/orgs.
  // Layouts may still pass a small `items` array as a pre-fetch hint; treat
  // the dropdown as enabled regardless of its size.
  const items = searchItems ?? [];
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
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
        {showSearch && (
          /* Desktop: live-search dropdown. Projects + clients load on
              first focus via /api/search/orgs; the fallback `items` array
              is shown until that resolves. */
          <div className="hidden md:block">
            <TopbarSearch
              items={items}
              activityHrefBase={searchActivityHrefBase}
              orgsHrefBase={searchOrgsHrefBase}
            />
          </div>
        )}
        {showSearch && (
          /* Mobile: icon button that opens the search inside a dialog so
              phone users can still reach projects + activities. */
          <button
            type="button"
            aria-label="Search"
            onClick={() => setMobileSearchOpen(true)}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          >
            <Search className="size-4" />
          </button>
        )}
        <div className="flex items-center gap-1 md:gap-2">
          {extra}
          <ThemeToggle />
          <UserDropdown name={name} email={email} avatarUrl={avatarUrl} />
        </div>
      </div>
      {showSearch && (
        <Dialog open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Search</DialogTitle>
            </DialogHeader>
            <TopbarSearch
              items={items}
              activityHrefBase={searchActivityHrefBase}
              orgsHrefBase={searchOrgsHrefBase}
              onSelect={() => setMobileSearchOpen(false)}
              autoFocus
            />
          </DialogContent>
        </Dialog>
      )}
    </header>
  );
}
