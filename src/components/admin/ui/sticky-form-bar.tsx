"use client";

import type { ReactNode } from "react";

export function StickyFormBar({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  if (!visible) return null;
  // Mobile: lift above the fixed bottom nav and respect the iOS home indicator.
  // Negative margins match each breakpoint's page padding (px-4 on mobile,
  // md:px-8 on desktop) so the bar spans the full content width.
  return (
    <div
      className={
        "sticky z-10 -mx-4 mt-6 border-t border-border bg-background/95 px-4 py-3 supports-[backdrop-filter]:backdrop-blur md:-mx-8 md:px-8 " +
        // Mobile: clear the fixed bottom nav + iOS home indicator.
        "bottom-[calc(var(--mobile-bottom-nav-h,60px)+env(safe-area-inset-bottom,0px))] md:bottom-0"
      }
    >
      <div className="flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}
