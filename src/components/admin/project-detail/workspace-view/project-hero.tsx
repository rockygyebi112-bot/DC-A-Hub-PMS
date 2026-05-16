import Link from "next/link";
import { Clock, Eye, Pencil, SlidersHorizontal } from "lucide-react";
import { UserAvatar } from "@/components/admin/ui/user-avatar";
import { formatRelative } from "@/components/admin/project-detail/parts";
import type { WorkspaceViewProps } from "./types";

export function ProjectHero(props: WorkspaceViewProps) {
  const percent =
    props.totalCount === 0
      ? 0
      : Math.round((props.doneCount / props.totalCount) * 100);
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-[32px]">
            {props.projectName}
          </h1>
          {props.status === "active" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          )}
          {props.status !== "active" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold capitalize text-muted-foreground">
              {props.status}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/70">
            {props.projectCode}
          </span>
          {props.clientName && (
            <>
              {" "}
              <span className="text-muted-foreground/60">•</span>{" "}
              <span>{props.clientName}</span>
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />
            Updated {formatRelative(props.updatedAt)}
          </span>
          {props.managerName && (
            <span className="inline-flex items-center gap-1.5">
              <UserAvatar
                name={props.managerName}
                email={props.managerEmail ?? props.managerName}
                size="sm"
                className="size-5"
              />
              <span className="font-medium text-foreground">
                {props.managerName}
              </span>
              <span className="text-muted-foreground/70">
                (Project Manager)
              </span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="relative inline-flex size-3.5 items-center justify-center">
              <svg viewBox="0 0 24 24" className="size-3.5 -rotate-90">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.18"
                  strokeWidth="3"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="var(--status-on-track)"
                  strokeWidth="3"
                  strokeDasharray={`${(percent / 100) * 56.5} 56.5`}
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="font-medium text-foreground">
              {percent}% complete
            </span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/workspace/projects/${props.projectId}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--color-dca-blue-500)] px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-dca-blue-600)]"
        >
          <SlidersHorizontal className="size-4" />
          Manage workplan
        </Link>
        <Link
          href={`/portal/projects/${props.projectId}`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Eye className="size-4" />
          Client view
        </Link>
        <Link
          href={`/admin/projects/${props.projectId}/edit`}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Edit project"
        >
          <Pencil className="size-4" />
        </Link>
      </div>
    </div>
  );
}
