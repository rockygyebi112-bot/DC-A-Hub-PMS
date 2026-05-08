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
  return (
    <div className="sticky bottom-0 -mx-6 md:-mx-8 mt-6 border-t bg-background/95 px-6 md:px-8 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 z-10">
      <div className="flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}
