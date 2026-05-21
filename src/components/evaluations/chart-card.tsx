import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * Shared frame for every evaluation chart and its empty / error states, so
 * each visualization sits in the same Card surface with a consistent title.
 */
export function ChartCard({
  title,
  tone = "default",
  children,
}: {
  title: string;
  tone?: "default" | "error";
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "p-4",
        tone === "error" && "border-destructive/40 bg-destructive/10",
      )}
    >
      <h3 className="mb-2 text-sm font-medium text-foreground">{title}</h3>
      {children}
    </Card>
  );
}
