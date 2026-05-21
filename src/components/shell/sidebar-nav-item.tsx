"use client";

import Link from "next/link";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NavIcon, type NavItem } from "./nav-utils";

interface SidebarNavItemProps {
  item: NavItem;
  active: boolean;
  /** Collapsed rail: icon-only, label shown via a hover tooltip. */
  collapsed?: boolean;
  /** Called on click — used by the mobile drawer to close itself. */
  onNavigate?: () => void;
}

// Canonical sidebar nav link styling. Single source of truth shared by the
// desktop rail (expanded + collapsed) and the mobile drawer.
const linkBase =
  "flex min-h-11 items-center rounded-lg text-sm transition-colors-smooth focus-ring-inset";

const linkState = (active: boolean) =>
  active
    ? "bg-[var(--color-dca-blue-500)] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
    : "text-white/70 hover:bg-white/5 hover:text-white";

export function SidebarNavItem({
  item,
  active,
  collapsed,
  onNavigate,
}: SidebarNavItemProps) {
  const icon = (
    <span className="flex size-5 shrink-0 items-center justify-center">
      <NavIcon
        name={item.icon}
        className="size-[18px]"
        strokeWidth={active ? 2.25 : 1.75}
      />
    </span>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={item.href}
              prefetch
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(linkBase, "justify-center px-0", linkState(active))}
            >
              {icon}
            </Link>
          }
        />
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href={item.href}
      prefetch
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(linkBase, "gap-2.5 px-3", linkState(active))}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge != null && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums",
            active ? "bg-white/20 text-white" : "bg-white/10 text-white/70",
          )}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}
