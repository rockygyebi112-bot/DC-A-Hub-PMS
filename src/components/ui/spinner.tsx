import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "default" | "lg";
  label?: string;
}

const sizeMap = {
  xs: "size-3",
  sm: "size-4",
  default: "size-5",
  lg: "size-6",
} as const;

/**
 * Accessible loading spinner. Always renders an sr-only label so screen
 * readers announce the loading state.
 */
export function Spinner({
  size = "default",
  label = "Loading",
  className,
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}
      {...props}
    >
      <Loader2 className={cn("animate-spin", sizeMap[size])} aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}
