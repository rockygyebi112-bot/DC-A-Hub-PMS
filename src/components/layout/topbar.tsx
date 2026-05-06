"use client";

import Image from "next/image";
import { useUser } from "@/hooks/use-user";
import { useSidebar } from "@/lib/sidebar-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, ChevronDown, Menu } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { NotificationsPopover } from "./notifications-popover";

export function Topbar() {
  const { user, signOut } = useUser();
  const { toggleMobile } = useSidebar();

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="sticky top-0 z-30 h-14 bg-card/90 dark:bg-card/95 backdrop-blur-md border-b border-border/50 flex items-center justify-between px-4 sm:px-6 lg:px-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
      {/* Left: hamburger (mobile) + logo (mobile) */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={toggleMobile}
          className="p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted/80 transition-all duration-200 ease-out"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Image
            src="/srsf-logo.png"
            alt="SRSF"
            width={28}
            height={28}
            className="rounded-md"
          />
          <span className="text-sm font-bold text-foreground tracking-tight">
            SRSF MIS
          </span>
        </div>
      </div>

      {/* Desktop left spacer */}
      <div className="hidden lg:block" />

      {/* Right: theme toggle + role badge + user menu */}
      <div className="flex items-center gap-3">
        <NotificationsPopover />
        <ThemeToggle />
        {user?.role && (
          <Badge
            variant="secondary"
            className="bg-srsf-purple-50 text-srsf-purple-700 border border-srsf-purple-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/50 font-medium text-[11px] px-2.5 py-0.5 tracking-wide hidden sm:inline-flex"
          >
            {user.role.name}
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 px-1.5 hover:bg-muted active:bg-muted/80 transition-all duration-200 ease-out outline-none">
            <Avatar className="size-8 ring-2 ring-transparent hover:ring-border transition-all duration-200">
              <AvatarFallback className="bg-srsf-green-500 text-white text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground/80 hidden sm:inline">
              {user?.full_name || user?.email}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground hidden sm:inline" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user?.role && (
              <DropdownMenuItem className="gap-2 text-muted-foreground text-xs py-2 sm:hidden">
                <span className="font-medium text-foreground">{user.role.name}</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="gap-2 text-muted-foreground text-xs py-2">
              <User className="size-3.5" />
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={signOut}
              className="gap-2 text-destructive py-2"
            >
              <LogOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
