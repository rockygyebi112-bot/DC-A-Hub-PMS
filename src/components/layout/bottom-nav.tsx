"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  FolderKanban,
  ClipboardEdit,
  Settings,
} from "lucide-react";

const BOTTOM_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Programs", href: "/programs/enterprise-spotlight", icon: BarChart3 },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Data Entry", href: "/data-entry", icon: ClipboardEdit },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background lg:hidden">
      <div className="flex">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-1 flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors ${
                isActive
                  ? "text-srsf-green-600 dark:text-srsf-green-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-0 right-0 h-0.5 bg-srsf-green-600 dark:bg-srsf-green-400" />
              )}
              <item.icon className="size-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
