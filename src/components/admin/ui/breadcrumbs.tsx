"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

type Crumb = { href: string; label: string };

const STATIC_LABELS: Record<string, string> = {
  admin: "Admin",
  clients: "Clients",
  projects: "Projects",
  users: "Users",
  team: "Team",
  new: "New",
};

export function Breadcrumbs({ trail }: { trail?: Crumb[] }) {
  const pathname = usePathname();
  const segments = trail ?? buildTrailFromPath(pathname);

  if (segments.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 overflow-hidden text-sm">
      {segments.map((c, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={c.href} className="flex min-w-0 items-center gap-1">
            {i > 0 && (
              <ChevronRight className="size-3.5 text-muted-foreground" />
            )}
            {isLast ? (
              <span className="truncate font-medium text-foreground">{c.label}</span>
            ) : (
              <Link
                href={c.href}
                className="truncate text-muted-foreground hover:text-foreground"
              >
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function buildTrailFromPath(pathname: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let acc = "";
  for (const p of parts) {
    acc += "/" + p;
    const label =
      STATIC_LABELS[p] ??
      (p.length > 12 && /^[0-9a-f-]+$/i.test(p) ? "Detail" : p);
    crumbs.push({ href: acc, label });
  }
  return crumbs;
}
