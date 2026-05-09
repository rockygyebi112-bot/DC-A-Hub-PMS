"use client";

import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { ThemeToggle } from "./theme-toggle";
import { UserDropdown } from "./user-dropdown";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import type { NotificationFeed } from "@/lib/notifications/queries";

export function AdminTopbar({
  name,
  email,
  greeting,
  greetingSubtitle,
  notifications,
}: {
  name: string;
  email: string;
  /** When provided AND path is /admin, renders a personalised greeting instead of breadcrumbs. */
  greeting?: string;
  greetingSubtitle?: string;
  notifications?: NotificationFeed;
}) {
  const pathname = usePathname();
  const showGreeting = !!greeting && pathname === "/admin";
  return (
    <header className="topbar-glass sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b px-4 md:px-6">
      <button
        type="button"
        aria-label="Toggle menu"
        className="hidden size-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted md:inline-flex"
      >
        <Menu className="size-4" />
      </button>

      <div className="min-w-0 flex-1 overflow-hidden">
        {showGreeting ? (
          <div className="topbar-greeting">
            <h1>{greeting}</h1>
            {greetingSubtitle && <p>{greetingSubtitle}</p>}
          </div>
        ) : (
          <Breadcrumbs />
        )}
      </div>

      <div className="hidden md:block">
        <label className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search projects, tasks, teams..."
            className="h-10 w-[300px] rounded-full border border-border bg-muted/40 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background lg:w-[360px]"
          />
        </label>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <NotificationsBell
          entries={notifications?.entries ?? []}
          unreadCount={notifications?.unreadCount ?? 0}
          lastReadAt={notifications?.lastReadAt ?? null}
        />
        <ThemeToggle />
        <UserDropdown name={name} email={email} />
      </div>
    </header>
  );
}
