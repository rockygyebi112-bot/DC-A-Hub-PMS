"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/constants";

interface SidebarNavItemProps {
  item: NavItem;
  onNavigate?: () => void;
  iconOnly?: boolean;
}

export function SidebarNavItem({
  item,
  onNavigate,
  iconOnly = false,
}: SidebarNavItemProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(
    item.children?.some((child) => pathname.startsWith(child.href)) ?? false
  );

  const isActive =
    pathname === item.href ||
    item.children?.some((child) => pathname === child.href);

  const Icon = item.icon;

  if (iconOnly) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        title={item.label}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 ease-out",
          isActive
            ? "bg-srsf-green-600/15 text-srsf-green-400"
            : "text-white/60 hover:text-white hover:bg-white/10 active:bg-white/15"
        )}
      >
        <Icon className="size-5 shrink-0" />
      </Link>
    );
  }

  if (item.children) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "relative w-full flex items-center gap-3 px-3 py-3 lg:py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-out",
            isActive
              ? "bg-srsf-green-600/15 text-srsf-green-400"
              : "text-white/60 hover:text-white hover:bg-white/10 active:bg-white/15"
          )}
        >
          {isActive && (
            <span className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full bg-srsf-green-500" />
          )}
          <Icon className={cn("size-5 lg:size-4 shrink-0", isActive ? "text-srsf-green-400" : "text-white/40")} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            className={cn(
              "size-4 lg:size-3.5 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </button>
        {expanded && (
          <div className="ml-7 mt-0.5 space-y-0.5 border-l border-white/[0.07] pl-3">
            {item.children.map((child) => {
              const childActive = pathname === child.href;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  className={cn(
                    "block px-2.5 py-2 lg:py-1.5 rounded-md text-[12px] transition-all duration-200 ease-out",
                    childActive
                      ? "bg-srsf-green-600/15 text-srsf-green-400 font-medium"
                      : "text-white/50 hover:text-white hover:bg-white/10 active:bg-white/15"
                  )}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-3 px-3 py-3 lg:py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-out",
        isActive
          ? "bg-srsf-green-600/15 text-srsf-green-400"
          : "text-white/60 hover:text-white hover:bg-white/10 active:bg-white/15"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full bg-srsf-green-500" />
      )}
      <Icon className={cn("size-5 lg:size-4 shrink-0", isActive ? "text-srsf-green-400" : "text-white/40")} />
      <span>{item.label}</span>
    </Link>
  );
}
