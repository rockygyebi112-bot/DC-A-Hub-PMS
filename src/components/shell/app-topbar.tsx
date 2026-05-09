"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ui/theme-toggle";
import { UserDropdown } from "@/components/admin/ui/user-dropdown";
import { Breadcrumbs } from "@/components/admin/ui/breadcrumbs";

export function AppTopbar({
  name,
  email,
  avatarUrl,
  showSearch = true,
  extra,
  greeting,
  greetingSubtitle,
  greetingPath,
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
}) {
  const pathname = usePathname();
  const showGreeting = !!greeting && (!greetingPath || pathname === greetingPath);
  return (
    <header className="topbar-glass sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b px-4 md:px-6">
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
      {showSearch && (
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
      <div className="flex items-center gap-2">
        {extra}avatarUrl={avatarUrl} 
        <ThemeToggle />
        <UserDropdown name={name} email={email} />
      </div>
    </header>
  );
}
