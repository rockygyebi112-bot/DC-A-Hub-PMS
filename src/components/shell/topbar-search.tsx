"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchItem = {
  href: string;
  label: string;
  /** Group label shown next to each result (e.g. "Your projects"). */
  group?: string;
};

/**
 * Topbar search with live dropdown. Filters across the navigation items
 * passed in (typically every project the user can access). Clicking a
 * result — or pressing Enter on the highlighted row — navigates to it.
 */
export function TopbarSearch({ items }: { items: SearchItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as SearchItem[];
    return items
      .filter((it) => it.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [items, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // Close the dropdown when the user clicks outside the search container.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function commit(item: SearchItem) {
    setOpen(false);
    setQuery("");
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = matches[highlight];
      if (item) commit(item);
    }
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative">
      <label className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search projects..."
          className="h-10 w-[300px] rounded-full border border-border bg-muted/40 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background lg:w-[340px]"
        />
      </label>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-auto rounded-xl border bg-popover p-1 shadow-lg">
          {matches.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matches for &quot;{query}&quot;
            </div>
          ) : (
            <ul>
              {matches.map((item, i) => {
                const active = i === highlight;
                return (
                  <li key={`${item.href}-${i}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onMouseDown={(e) => {
                        // Prevent the input from blurring before our click
                        // navigates — otherwise the dropdown closes first.
                        e.preventDefault();
                      }}
                      onClick={() => commit(item)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                        active ? "bg-accent text-foreground" : "hover:bg-accent",
                      )}
                    >
                      <span className="min-w-0 truncate">{item.label}</span>
                      {item.group && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {item.group}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
