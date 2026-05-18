"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function FilterChips({
  paramName,
  options,
  allLabel = "All",
  counts,
}: {
  paramName: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  counts?: Record<string, number>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const current = params.get(paramName) ?? "";

  function go(value: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (!value) next.delete(paramName);
    else next.set(paramName, value);
    // Reset pagination on filter change — otherwise a user on page 5 of one
    // chip lands on an empty page when switching to a chip with fewer rows.
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const totalCount = counts
    ? Object.values(counts).reduce((sum, v) => sum + v, 0)
    : undefined;

  const items = [{ value: "", label: allLabel }, ...options];
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => {
        const selected = it.value === current;
        const count = counts
          ? it.value === ""
            ? totalCount
            : counts[it.value] ?? 0
          : undefined;
        const isEmpty = counts != null && count === 0 && it.value !== "";
        return (
          <button
            key={it.value || "all"}
            type="button"
            onClick={() => (isEmpty ? undefined : go(it.value))}
            disabled={isEmpty}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-accent",
              isEmpty && "opacity-50 cursor-not-allowed hover:bg-background",
            )}
          >
            {count != null ? `${it.label} · ${count}` : it.label}
          </button>
        );
      })}
    </div>
  );
}
