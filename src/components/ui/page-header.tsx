import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard page header used across admin / workspace / portal sections.
 *
 * Provides a consistent title hierarchy, optional eyebrow (small label
 * above the title — useful for section names), description, and a
 * right-aligned action slot. Designed to be dropped at the top of any
 * page below the AppShell topbar.
 *
 * Keep usage minimal — the goal is one source of truth for page-level
 * typography and spacing, not a heavy layout primitive.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  icon,
  className,
  align = "between",
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Small uppercase label rendered above the title (e.g. "Project"). */
  eyebrow?: ReactNode;
  /** Right-aligned actions (typically Buttons). */
  actions?: ReactNode;
  /** Optional leading icon / avatar / status block. */
  icon?: ReactNode;
  className?: string;
  /** Layout of title vs actions. `between` = space-between on >=sm. */
  align?: "between" | "stack";
}) {
  return (
    <header
      className={cn(
        "mb-5 flex flex-col gap-3",
        align === "between" && "sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <div className="shrink-0 pt-0.5" aria-hidden>
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-heading text-xl font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground line-clamp-1 sm:line-clamp-none">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
