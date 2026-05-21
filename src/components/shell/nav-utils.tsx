import {
  Activity,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Icons are referenced by string name (not component) because the
// Server -> Client component boundary cannot serialize functions. This is
// the single source of truth — every shell nav surface resolves icons here.
export type IconName =
  | "layout-dashboard"
  | "folder-kanban"
  | "list-checks"
  | "users"
  | "building-2"
  | "activity"
  | "calendar-days"
  | "check-circle-2"
  | "clipboard-list"
  | "file-text"
  | "inbox"
  | "settings";

export const NAV_ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "folder-kanban": FolderKanban,
  "list-checks": ListChecks,
  users: Users,
  "building-2": Building2,
  activity: Activity,
  "calendar-days": CalendarDays,
  "check-circle-2": CheckCircle2,
  "clipboard-list": ClipboardList,
  "file-text": FileText,
  inbox: Inbox,
  settings: Settings,
};

/** Resolve a string icon key to its Lucide component, defaulting to a
 *  dashboard glyph for unknown keys. */
export function resolveNavIcon(name: string): LucideIcon {
  return NAV_ICONS[name] ?? LayoutDashboard;
}

/** Renders the Lucide glyph for a nav icon key. Use this rather than
 *  resolving the component yourself — it keeps icon lookup in one place
 *  and avoids the static-component lint rule at call sites. */
export function NavIcon({
  name,
  className,
  strokeWidth,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = NAV_ICONS[name] ?? LayoutDashboard;
  return <Icon className={className} strokeWidth={strokeWidth} />;
}

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  badge?: string | number;
};

export type NavGroup = {
  group?: string;
  items: NavItem[];
};

export type ProjectBrand = {
  name: string;
  logoUrl: string | null;
};

/** Whether a nav item should render as active for the current pathname.
 *  `exact` items match only their own href; others also match descendant
 *  routes (`/href/...`). */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
