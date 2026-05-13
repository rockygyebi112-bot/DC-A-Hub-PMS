"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/admin/ui/theme-toggle";
import { UserDropdown } from "@/components/admin/ui/user-dropdown";
import { Breadcrumbs } from "@/components/admin/ui/breadcrumbs";
import { TopbarSearch, type SearchItem } from "./topbar-search";
import { Search } from "lucide-react";
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
  const pathname = usePathname();
  const showGreeting = !!greeting && (!greetingPath || pathname === greetingPath);
  const items = searchItems ?? [];
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
          ) : showBreadcrumbs ? (
            <Breadcrumbs />
          ) : null}
        </div>
        {/* Push right-side icons to the edge on mobile when greeting row is split out. */}
        {showGreeting && <div className="flex-1 sm:hidden" aria-hidden />}
        {showSearch && items.length > 0 && (
          /* Desktop only: live-search dropdown over the user's projects. */
          <div className="hidden md:block">
            <TopbarSearch items={items} activityHrefBase={searchActivityHrefBase} />
          </div>
        )}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Cmd/Ctrl+K palette trigger (desktop). Dispatches a custom
              event picked up by <CommandPalette /> mounted in AppShell. */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("cmdk:toggle"));
              }
            }}
            aria-label="Open command palette"
            className="hidden h-9 items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted md:inline-flex"
          >
            <Search className="size-3.5" />
            <span className="hidden lg:inline">Quick search</span>
            <kbd className="ml-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </button>
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
