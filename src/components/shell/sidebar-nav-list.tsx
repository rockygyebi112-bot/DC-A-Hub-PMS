"use client";

import { usePathname } from "next/navigation";

import { SidebarNavItem } from "./sidebar-nav-item";
import { isNavItemActive, type NavGroup } from "./nav-utils";

/**
 * Vertical nav list shared by the desktop sidebar (expanded + collapsed) and
 * the mobile drawer. Each row is a SidebarNavItem, which owns the link
 * styling for both states.
 */
export function SidebarNavList({
  groups,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  /** Collapsed rail: icon-only rows, group labels hidden. */
  collapsed?: boolean;
  /** Called when a nav link is clicked (used to close the mobile drawer). */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3">
      {groups.map((group, idx) => (
        <div key={idx} className="space-y-1">
          {!collapsed && group.group && (
            <p className="nav-group-label px-3 pb-1">{group.group}</p>
          )}
          {group.items.map((item) => (
            <SidebarNavItem
              key={item.href}
              item={item}
              active={isNavItemActive(item, pathname)}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}
