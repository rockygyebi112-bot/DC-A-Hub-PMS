import { Suspense, type ReactNode } from "react";
import { AppSidebar, type NavGroup, type NavItem, type ProjectBrand } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import type { SearchItem } from "./topbar-search";
import { MobileNav } from "./mobile-nav";
import { BottomNav } from "./bottom-nav";
import { CommandPalette } from "./command-palette";
import { NavProgress } from "./nav-progress";
import { cn } from "@/lib/utils";

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
  bottomNavItems,
  searchItems,
  searchActivityHrefBase,
  showBreadcrumbs,
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
  /** Optional explicit list of bottom-tab destinations. Defaults to the
   *  first four nav items across `groups`. */
  bottomNavItems?: NavItem[];
  /** Items powering the topbar search dropdown. Layouts should pass their
   *  full project list here — the sidebar `groups` are usually truncated
   *  for visual reasons, so falling back to them silently breaks search. */
  searchItems?: SearchItem[];
  /** Base path used when navigating to activity matches in the search
   *  dropdown. Workspace + admin shells default to `/workspace`; the
   *  portal shell overrides this to `/portal`. */
  searchActivityHrefBase?: "/workspace" | "/portal";
  /** Hide the path-based breadcrumb trail in the topbar. */
  showBreadcrumbs?: boolean;
}) {
  return (
    // overflow-x-clip defends against any single child (table, long
    // unbreakable string, hardcoded width) bleeding past the viewport on
    // phones and causing the whole page to scroll horizontally. We avoid
    // overflow-x-hidden here because it establishes a scroll container that
    // breaks `position: sticky` on the sidebar — causing the navy nav to
    // scroll away with the page instead of pinning to the viewport. Tables
    // that genuinely need horizontal scroll still scroll within their own
    // overflow-x-auto container.
    <div className="flex min-h-screen overflow-x-clip bg-background text-foreground">
      {/* Global route-change progress bar (top of viewport). */}
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      {/* Global command palette — Cmd/Ctrl+K opens it from anywhere. */}
      <CommandPalette
        items={searchItems ?? []}
        activityHrefBase={searchActivityHrefBase}
      />
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
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <AppTopbar
          name={user.name}
          email={user.email}
          avatarUrl={user.avatarUrl}
          extra={topbarExtra}
          greeting={greeting}
          greetingSubtitle={greetingSubtitle}
          greetingPath={greetingPath}
          searchItems={searchItems}
          searchActivityHrefBase={searchActivityHrefBase}
          showBreadcrumbs={showBreadcrumbs}
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
          <div
            className={cn(
              "page-enter mx-auto w-full max-w-7xl px-4 py-6 md:px-8",
              // Reserve space for the fixed bottom nav on mobile so the last
              // bit of content isn't trapped behind it (plus iOS safe area).
              "pb-[calc(var(--mobile-bottom-nav-h,60px)+env(safe-area-inset-bottom)+1rem)] md:pb-6",
            )}
          >
            {children}
          </div>
        </main>
      </div>
      <BottomNav groups={groups} items={bottomNavItems} />
    </div>
  );
}
