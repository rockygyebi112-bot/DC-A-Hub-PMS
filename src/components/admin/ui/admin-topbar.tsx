import { Breadcrumbs } from "./breadcrumbs";
import { ThemeToggle } from "./theme-toggle";
import { UserDropdown } from "./user-dropdown";

export function AdminTopbar({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <div className="min-w-0 overflow-hidden">
        <Breadcrumbs />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <UserDropdown name={name} email={email} />
      </div>
    </header>
  );
}
