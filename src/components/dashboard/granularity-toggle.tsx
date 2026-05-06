"use client";

import { cn } from "@/lib/utils";
import type { Granularity } from "./chart-builders";

interface GranularityToggleProps {
  value: Granularity;
  onChange: (g: Granularity) => void;
}

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: "week", label: "W" },
  { value: "month", label: "M" },
  { value: "quarter", label: "Q" },
];

export function GranularityToggle({ value, onChange }: GranularityToggleProps) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden shrink-0">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1 text-xs font-medium transition-colors",
            value === opt.value
              ? "bg-srsf-green-500 text-white"
              : "bg-card text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
