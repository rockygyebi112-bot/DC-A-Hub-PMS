"use client";

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onToggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="self-end"
    >
      {collapsed ? (
        <ChevronsRight className="size-4" />
      ) : (
        <ChevronsLeft className="size-4" />
      )}
    </Button>
  );
}
