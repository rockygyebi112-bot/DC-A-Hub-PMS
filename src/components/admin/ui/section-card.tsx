import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  children,
  tone = "default",
  action,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "destructive";
  action?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--admin-card-radius)] border bg-card text-card-foreground shadow-sm",
        tone === "destructive" && "border-destructive/30",
      )}
    >
      {(title || description || action) && (
        <header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {title && (
              <h2
                className={cn(
                  "text-base font-semibold",
                  tone === "destructive" && "text-destructive",
                )}
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
