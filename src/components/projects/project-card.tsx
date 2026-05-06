"use client";

import Link from "next/link";
import type {
  ComputedProjectStatus,
  Project,
  ProjectActivity,
} from "@/features/projects";
import {
  computeProgressPercent,
  computeProjectStatus,
  countOverdue,
  countNeedsAttention,
} from "@/features/projects";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

const STATUS_STRIPE: Record<ComputedProjectStatus, string> = {
  not_started: "#94a3b8",
  in_progress: "#5BBF3A",
  at_risk: "#f59e0b",
  blocked: "#dc2626",
  done: "#16a34a",
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type Variant = "full" | "compact";

interface ProjectCardProps {
  project: Project;
  activities: ProjectActivity[];
  variant?: Variant;
}

function programLabel(slug?: string | null): string {
  if (!slug) return "";
  return slug.replace(/-/g, " ").toUpperCase();
}

export function ProjectCard({
  project,
  activities,
  variant = "full",
}: ProjectCardProps) {
  const status = computeProjectStatus(project, activities);
  const progress = computeProgressPercent(activities);
  const overdue = countOverdue(activities);
  const needsAttention = countNeedsAttention(activities);
  const isCompact = variant === "compact";
  const stripeColor = STATUS_STRIPE[status];

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group block rounded-xl border border-border bg-card hover:border-border/80 hover:shadow-lg dark:hover:shadow-black/30 transition-all overflow-hidden"
    >
      <div
        className="h-[3px] group-hover:h-[4px] transition-all duration-200"
        style={{ background: stripeColor }}
      />

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="size-9 rounded-xl flex items-center justify-center text-[10px] font-extrabold text-white shrink-0"
              style={{
                background: `linear-gradient(135deg, #6B2D7B, ${stripeColor})`,
              }}
            >
              {initialsOf(project.name)}
            </div>
            <div className="min-w-0">
              <h3
                className={cn(
                  "truncate",
                  isCompact ? "text-sm font-medium" : "text-sm font-semibold",
                )}
              >
                {project.name}
              </h3>
              {project.program_slug && (
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
                  {programLabel(project.program_slug)}
                </p>
              )}
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {!isCompact && project.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {project.description}
          </p>
        )}

        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-muted-foreground/80">Progress</span>
          <span className="text-[11px] font-semibold" style={{ color: stripeColor }}>
            {progress}%
          </span>
        </div>
        <div className="h-[6px] bg-muted rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progress}%`,
              background: stripeColor,
              boxShadow: `0 0 6px ${stripeColor}60`,
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <Calendar className="size-3" />
            {project.target_end_date ? (
              <span>{new Date(project.target_end_date).toLocaleDateString()}</span>
            ) : (
              <span>No target date</span>
            )}
          </div>
          <div className="flex gap-1">
            {overdue > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 font-medium">
                {overdue} overdue
              </span>
            )}
            {needsAttention > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
                {needsAttention} needs attention
              </span>
            )}
            {overdue === 0 && needsAttention === 0 && progress > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 font-medium">
                On track
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
