"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useBreadcrumbLabels } from "@/components/shell/breadcrumb-context";

type Crumb = { href: string; label: string };

const STATIC_LABELS: Record<string, string> = {
  admin: "Admin",
  workspace: "Workspace",
  portal: "Portal",
  account: "Account",
  clients: "Clients",
  projects: "Projects",
  users: "Users",
  team: "Team",
  new: "New",
  edit: "Edit",
  budget: "Budget",
  phases: "Phases",
  activities: "Activities",
  uploads: "Uploads",
  workplan: "Workplan",
  "data-entry": "Data entry",
};

const UUID_LIKE = /^[0-9a-f-]{12,}$/i;

function humanize(segment: string) {
  return segment
    .split("-")
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(" ");
}

export function Breadcrumbs({ trail }: { trail?: Crumb[] }) {
  const pathname = usePathname();
  const labels = useBreadcrumbLabels();
  const segments = trail ?? buildTrailFromPath(pathname, labels);

  if (segments.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 overflow-hidden text-sm">
      {segments.map((c, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={c.href} className="flex min-w-0 items-center gap-1">
            {i > 0 && (
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
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

function buildTrailFromPath(pathname: string, labels: Record<string, string>): Crumb[] {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let acc = "";
  for (const p of parts) {
    acc += "/" + p;
    // Priority order:
    //   1. Static label table (admin, projects, team, …) so casing stays
    //      consistent regardless of context.
    //   2. Context-provided label for ID-shaped segments (UUIDs registered
    //      by the layout seed or a nested page).
    //   3. UUID-shaped fallback: only show "Detail" if nothing else
    //      resolved — better than a raw UUID, worse than the real name.
    //   4. Humanised slug for kebab-case routes (e.g. "data-entry").
    let label = STATIC_LABELS[p];
    if (!label && labels[p]) label = labels[p];
    if (!label && UUID_LIKE.test(p)) label = "Detail";
    if (!label) label = humanize(p);
    crumbs.push({ href: acc, label });
  }
  return crumbs;
}
