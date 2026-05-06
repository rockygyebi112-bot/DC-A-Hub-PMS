"use client";

import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear: () => void;
}

export function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  onClear,
}: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        aria-label="From date"
        className="h-8 w-[7.5rem] sm:w-36 text-xs px-2"
      />
      <span className="text-muted-foreground text-xs shrink-0">–</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        aria-label="To date"
        className="h-8 w-[7.5rem] sm:w-36 text-xs px-2"
      />
      {(from || to) && (
        <button
          type="button"
          onClick={onClear}
          className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted shrink-0"
          title="Clear dates"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
