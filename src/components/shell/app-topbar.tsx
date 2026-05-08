import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/admin/ui/theme-toggle";
import { UserDropdown } from "@/components/admin/ui/user-dropdown";
import { Breadcrumbs } from "@/components/admin/ui/breadcrumbs";

export function AppTopbar({
  name,
  email,
  showSearch = true,
}: {
  name: string;
  email: string;
  showSearch?: boolean;
}) {
  return (
    <header className="topbar-glass sticky top-0 z-20 flex h-[var(--topbar-height,58px)] items-center gap-3 border-b px-4 md:px-6">
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      {showSearch && (
        <div className="hidden md:block">
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search…"
              className="h-8 w-64 rounded-lg border border-input bg-muted/50 pl-8 pr-12 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background"
            />
            <kbd className="pointer-events-none absolute right-2 font-mono text-[10px] border rounded bg-muted/60 px-1.5 py-0.5 text-muted-foreground">
              ⌘K
            </kbd>
          </label>
        </div>
      )}
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserDropdown name={name} email={email} />
      </div>
    </header>
  );
}
