import { cn } from "@/lib/utils";

interface AuthAlertProps {
  variant: "error" | "success";
  children: React.ReactNode;
  className?: string;
}

/**
 * Inline banner for auth form errors and success messages.
 * Error uses role="alert" (assertive); success uses role="status" (polite).
 */
export function AuthAlert({ variant, children, className }: AuthAlertProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border p-3 text-sm break-words",
        variant === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
        className,
      )}
    >
      {children}
    </div>
  );
}
