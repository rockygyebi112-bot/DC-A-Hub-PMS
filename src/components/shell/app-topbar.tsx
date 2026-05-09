import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ui/theme-toggle";
import { UserDropdown } from "@/components/admin/ui/user-dropdown";
import { Breadcrumbs } from "@/components/admin/ui/breadcrumbs";

export function AppTopbar({
  name,
  email,
  showSearch = true,
  extra,
}: {
  name: string;
  email: string;
  showSearch?: boolean;
  extra?: ReactNode;
}) {
  return (
    <header className="topbar-glass sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b px-4 md:px-6">
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
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
        {extra}
        <ThemeToggle />
        <UserDropdown name={name} email={email} />
      </div>
    </header>
  );
}
