import type { ReactNode } from "react";
import { AppSidebar, type NavGroup, type ProjectBrand } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { MobileNav } from "./mobile-nav";

export function AppShell({
  children,
  brand,
  subtitle,
  groups,
  storageKey,
  user,
  sidebarFooter,
  defaultLogoUrl,
  projectBrands,
  projectPathPrefix,
  topbarExtra,
  greeting,
  greetingSubtitle,
  greetingPath,
}: {
  children: ReactNode;
  brand: string;
  subtitle?: string;
  groups: NavGroup[];
  storageKey: string;
  user: { name: string; email: string; avatarUrl?: string | null };
  sidebarFooter?: ReactNode;
  defaultLogoUrl?: string;
  projectBrands?: Record<string, ProjectBrand>;
  projectPathPrefix?: string;
  topbarExtra?: ReactNode;
  greeting?: string;
  greetingSubtitle?: string;
  greetingPath?: string;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar
        brand={brand}
        subtitle={subtitle}
        groups={groups}
        storageKey={storageKey}
        footer={sidebarFooter}
        defaultLogoUrl={defaultLogoUrl}
        projectBrands={projectBrands}
        projectPathPrefix={projectPathPrefix}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          name={user.name}
          email={user.email}
          avatarUrl={user.avatarUrl}
          extra={topbarExtra}
          greeting={greeting}
          greetingSubtitle={greetingSubtitle}
          greetingPath={greetingPath}
          mobileNav={
            <MobileNav
              brand={brand}
              subtitle={subtitle}
              groups={groups}
              defaultLogoUrl={defaultLogoUrl}
              projectBrands={projectBrands}
              projectPathPrefix={projectPathPrefix}
              footer={sidebarFooter}
            />
          }
        />
        <main id="main-content" className="flex-1">
          <div className="page-enter mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
