import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Use "inline" for inside charts/cards, "page" for full-page states */
  variant?: "inline" | "page";
}

/**
 * EmptyState
 *
 * Friendly empty state with icon, message and optional call-to-action.
 *
 * Use `variant="inline"` (compact, the default) inside data containers -
 * table bodies, list sections, kanban columns, dropdown empty results.
 *
 * Use `variant="page"` (generous) only when the entire page has zero content
 * - first-run portal landing, brand-new workspace, no-search-results full-page.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  variant = "inline",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "page" ? "py-16 px-6" : "py-10 px-4",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-muted text-muted-foreground mb-4",
          variant === "page" ? "size-16" : "size-12"
        )}
      >
        <Icon
          className={variant === "page" ? "size-7" : "size-5"}
          strokeWidth={1.75}
        />
      </div>
      <h3
        className={cn(
          "font-semibold text-foreground tracking-tight",
          variant === "page" ? "text-base" : "text-sm"
        )}
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-muted-foreground max-w-sm mt-1",
            variant === "page" ? "text-sm" : "text-xs"
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
