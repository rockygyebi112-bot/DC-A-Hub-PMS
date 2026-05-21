import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Prop-based card shell for the common "titled section + body" case. Built
 * on the Card primitive so the surface styling (radius, border, shadow) is
 * defined in exactly one place.
 */
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
    <Card
      className={cn(
        "overflow-hidden",
        tone === "destructive" && "border-destructive/30",
      )}
    >
      {(title || description || action) && (
        <header className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            {title && (
              <h2
                className={cn(
                  "font-heading text-sm font-semibold tracking-tight",
                  tone === "destructive" && "text-destructive",
                )}
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}
