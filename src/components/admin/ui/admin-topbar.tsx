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
    <header className="h-14 border-b flex items-center justify-between px-4 md:px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
      <Breadcrumbs />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserDropdown name={name} email={email} />
      </div>
    </header>
  );
}
