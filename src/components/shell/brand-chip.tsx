import Image from "next/image";
import { Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface BrandChipProps {
  logoUrl?: string | null;
  /** Brand name — used for the logo's alt text. */
  label: string;
  size?: "sm" | "md";
}

const sizeClasses = {
  sm: { box: "size-9", img: "h-9 w-9", icon: "size-3.5", radius: "rounded-lg" },
  md: { box: "size-10", img: "h-10 w-10", icon: "size-4", radius: "rounded-xl" },
} as const;

/**
 * Square brand mark for the shell nav: shows the brand logo when available,
 * otherwise a flat solid fallback tile with a building glyph. Used by the
 * desktop sidebar (top + bottom) and the mobile drawer.
 */
export function BrandChip({ logoUrl, label, size = "md" }: BrandChipProps) {
  const s = sizeClasses[size];
  return (
    <div className={cn("flex shrink-0 items-center justify-center", s.box)}>
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${label} logo`}
          width={40}
          height={40}
          className={cn(s.img, "object-contain")}
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-primary text-white",
            s.radius,
          )}
        >
          <Building2 className={s.icon} aria-hidden />
        </div>
      )}
    </div>
  );
}
