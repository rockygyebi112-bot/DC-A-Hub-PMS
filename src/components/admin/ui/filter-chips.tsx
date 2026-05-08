"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function FilterChips({
  paramName,
  options,
  allLabel = "All",
}: {
  paramName: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const current = params.get(paramName) ?? "";

  function go(value: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (!value) next.delete(paramName);
    else next.set(paramName, value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const items = [{ value: "", label: allLabel }, ...options];
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => {
        const selected = it.value === current;
        return (
          <button
            key={it.value || "all"}
            type="button"
            onClick={() => go(it.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
