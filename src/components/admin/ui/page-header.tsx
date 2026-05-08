import type { ReactNode } from "react";
import { BackButton } from "@/components/ui/back-button";

export function PageHeader({
  title,
  subtitle,
  action,
  backFallbackHref = "/",
  showBack = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  backFallbackHref?: string;
  showBack?: boolean;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-3">
        {showBack && <BackButton fallbackHref={backFallbackHref} />}
        <div className="min-w-0 space-y-1">
          <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="text-pretty text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">{action}</div>}
    </header>
  );
}
