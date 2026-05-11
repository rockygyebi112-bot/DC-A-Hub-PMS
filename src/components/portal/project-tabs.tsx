"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, LayoutDashboard, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, base: string) => boolean;
};

/**
 * Horizontal tab strip rendered at the top of every portal project page.
 * Adds an "Uploads" entry so clients can find all documents in one place
 * without drilling into each activity.
 */
export function PortalProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/portal/projects/${projectId}`;

  const tabs: Tab[] = [
    {
      href: base,
      label: "Overview",
      icon: LayoutDashboard,
      match: (p, b) => p === b,
    },
    {
      href: `${base}/workplan`,
      label: "Workplan",
      icon: ListChecks,
      match: (p, b) => p.startsWith(`${b}/workplan`) || p.startsWith(`${b}/activities`),
    },
    {
      href: `${base}/uploads`,
      label: "Uploads",
      icon: FolderOpen,
      match: (p, b) => p.startsWith(`${b}/uploads`),
    },
  ];

  return (
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto border-b">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.match(pathname, base);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
