import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Small label/tag primitive used across admin, portal, and workspace.
 *
 * Use `variant` for generic color intent; use the `delivery-pill-*` utility
 * classes (in globals.css) when the badge reflects project delivery health.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/10 text-primary",
        secondary:
          "border-transparent bg-muted text-muted-foreground",
        outline:
          "border-border bg-background text-foreground",
        success:
          "border-transparent bg-[hsl(160_65%_94%)] text-[hsl(160_64%_28%)] dark:bg-[hsl(160_40%_22%)] dark:text-[hsl(160_60%_75%)]",
        warning:
          "border-transparent bg-[hsl(38_92%_94%)] text-[hsl(38_92%_32%)] dark:bg-[hsl(38_40%_22%)] dark:text-[hsl(38_90%_78%)]",
        destructive:
          "border-transparent bg-destructive/10 text-destructive",
        info:
          "border-transparent bg-[hsl(210_90%_95%)] text-[hsl(221_83%_42%)] dark:bg-[hsl(221_40%_22%)] dark:text-[hsl(217_90%_78%)]",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[10px]",
        default: "px-2 py-0.5 text-[11px]",
        lg: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

export function Badge({
  className,
  variant,
  size,
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
