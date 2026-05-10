"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavGroup } from "./app-sidebar";

// Icons are referenced by string name (server -> client boundary cannot
// serialize functions). Keep this map in sync with app-sidebar.tsx.
const ICONS: Record<string, LucideIcon> = {
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
  settings: Settings,
};

/**
 * Vertical nav list shared between the desktop sidebar (expanded state) and
 * the mobile drawer. The desktop sidebar's collapsed state has its own
 * tooltip-wrapped rendering and stays inside app-sidebar.tsx.
 */
export function SidebarNavList({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  /** Called when a nav link is clicked (used to close the mobile drawer). */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3">
      {groups.map((group, idx) => (
        <div key={idx} className="space-y-1">
          {group.group && (
            <p className="nav-group-label px-3 pb-1">{group.group}</p>
          )}
          {group.items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href ||
                pathname.startsWith(item.href + "/");
            const Icon = ICONS[item.icon] ?? LayoutDashboard;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  // 44px touch target on mobile per Apple HIG / Material;
                  // keeps 40px feel visually on desktop via inner padding.
                  "flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm transition-colors-smooth",
                  active
                    ? "bg-[var(--color-dca-blue-500)] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <span className="flex size-5 shrink-0 items-center justify-center">
                  <Icon
                    className="size-[18px]"
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge != null && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-white/10 text-white/70",
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
