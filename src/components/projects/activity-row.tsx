"use client";

import type { ProjectActivity } from "@/lib/projects/types";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronDown, ChevronRight, FolderTree } from "lucide-react";

const STATUS_DOT: Record<ProjectActivity["status"], string> = {
  not_started: "border-[#D3D1C7] bg-white",
  in_progress: "border-[#B5D4F4] bg-[#E6F1FB]",
  done: "border-[#C0DD97] bg-[#EAF3DE] text-[#3B6D11]",
  blocked: "border-[#F7C1C1] bg-[#FCEBEB] text-[#A32D2D]",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarTone(seed: string) {
  const palette = [
    "bg-[#E6F1FB] text-[#185FA5]",
    "bg-[#EAF3DE] text-[#3B6D11]",
    "bg-[#FAEEDA] text-[#BA7517]",
    "bg-[#FCEBEB] text-[#A32D2D]",
    "bg-[#EEEDFE] text-[#5847C5]",
    "bg-[#E1F5EE] text-[#0D7A52]",
    "bg-[#FBEAF0] text-[#B53D67]",
    "bg-[#F1EFE8] text-[#5F5E5A]",
  ];

  const hash = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

interface Props {
  activity: ProjectActivity;
  onOpen: (id: string) => void;
  ownerNameMap?: Record<string, string>;
  displayPercent?: number;
  childCount?: number;
  indent?: boolean;
  showTreeLine?: boolean;
  isLastChild?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function ActivityRow({
  activity,
  onOpen,
  ownerNameMap,
  childCount = 0,
  indent = false,
  isExpanded = true,
  onToggleExpand,
}: Props) {
  const hasChildren = childCount > 0;
  const ownerName = ownerNameMap?.[activity.owner_user_id ?? ""] ?? "Unassigned";
  const overdue =
    activity.due_date &&
    activity.status !== "done" &&
    new Date(activity.due_date) < new Date();

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5",
        indent && "pl-11",
      )}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleExpand?.();
        }}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground",
          !hasChildren && "invisible",
        )}
        aria-label={isExpanded ? "Collapse activity" : "Expand activity"}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>

      <button
        type="button"
        onClick={() => onOpen(activity.id)}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition hover:bg-muted/50",
          indent && "bg-muted/[0.18]",
        )}
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
            STATUS_DOT[activity.status],
          )}
        >
          {activity.status === "done" ? "\u2713" : ""}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "truncate text-sm text-foreground",
                activity.status === "done" && "text-muted-foreground line-through",
              )}
            >
              {activity.title}
            </span>
            {hasChildren && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] text-[#6B7280]">
                <FolderTree className="h-3 w-3" />
                {childCount}
              </span>
            )}
          </div>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          {activity.due_date && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px]",
                overdue ? "text-[#A32D2D]" : "text-[#6B7280]",
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {new Date(activity.due_date).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}

          <span
            className={cn(
              "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-semibold",
              getAvatarTone(activity.owner_user_id ?? ownerName),
            )}
            title={ownerName}
          >
            {getInitials(ownerName || "U")}
          </span>
        </div>
      </button>
    </div>
  );
}
