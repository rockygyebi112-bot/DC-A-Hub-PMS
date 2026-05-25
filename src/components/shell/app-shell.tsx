import { Suspense, type ReactNode } from "react";
import { AppSidebar, type NavGroup, type NavItem, type ProjectBrand } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import type { SearchItem } from "./topbar-search";
import { MobileNav } from "./mobile-nav";
import { BottomNav } from "./bottom-nav";
import { NavProgress } from "./nav-progress";
import { BreadcrumbProvider } from "./breadcrumb-context";
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
  searchOrgsHrefBase,
  showBreadcrumbs,
  breadcrumbSeed,
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
  /** Base path used when navigating to project/client matches lazily
   *  fetched from `/api/search/orgs`. Admin defaults to `/admin`. */
  searchOrgsHrefBase?: "/admin" | "/workspace" | "/portal";
  /** Hide the path-based breadcrumb trail in the topbar. */
  showBreadcrumbs?: boolean;
  /** Seed map for breadcrumb label resolution. Keys are URL segments
   *  (typically UUIDs); values are the friendly names to display. The
   *  layout passes the project + client lists it already loads so the
   *  breadcrumb can show real names without any extra DB calls. */
  breadcrumbSeed?: Record<string, string>;
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
    <BreadcrumbProvider seed={breadcrumbSeed}>
    <div className="flex min-h-screen overflow-x-clip bg-background text-foreground">
      {/* Keyboard skip link: hidden until focused, then jumps past the sidebar
          and topbar straight to the main content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-primary"
      >
        Skip to main content
      </a>
      {/* Global route-change progress bar (top of viewport). */}
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
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
          searchOrgsHrefBase={searchOrgsHrefBase}
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
    </BreadcrumbProvider>
  );
}
