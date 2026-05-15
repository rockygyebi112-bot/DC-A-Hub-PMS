"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchItem = {
  href: string;
  label: string;
  /** Group label shown next to each result (e.g. "Your projects"). */
  group?: string;
};

type SearchableActivity = {
  id: string;
  name: string;
  project_id: string;
  project_name: string;
  phase_name: string | null;
};

/**
 * Topbar search with live dropdown. Filters across the navigation items
 * passed in (typically every project the user can access). Clicking a
 * result — or pressing Enter on the highlighted row — navigates to it.
 *
 * Activities are fetched lazily from `/api/search/activities` the first
 * time the dropdown opens so the layout doesn't have to pay for a 200-row
 * activities join on every page navigation. `activityHrefBase` decides
 * whether matches link into `/workspace` or `/portal`.
 */
export function TopbarSearch({
  items,
  activityHrefBase = "/workspace",
}: {
  items: SearchItem[];
  activityHrefBase?: "/workspace" | "/portal";
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [prevQuery, setPrevQuery] = useState("");
  const [activities, setActivities] = useState<SearchableActivity[]>([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadActivities = useCallback(async () => {
    if (activitiesLoaded) return;
    setActivitiesLoaded(true); // optimistic so we don't double-fetch
    try {
      const res = await fetch("/api/search/activities", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as SearchableActivity[];
      if (Array.isArray(data)) setActivities(data);
    } catch {
      // best-effort: project search still works without activities
    }
  }, [activitiesLoaded]);

  // Defensive dedupe: layouts can stitch projects + activities + clients
  // together, and any accidental duplicate href would otherwise produce a
  // React "duplicate key" warning when the dropdown renders.
  const dedupedItems = useMemo(() => {
    const activityItems: SearchItem[] = activities.map((a) => ({
      href: `${activityHrefBase}/projects/${a.project_id}/activities/${a.id}`,
      label: a.name,
      group: `Activity · ${a.project_name}`,
    }));
    const seen = new Set<string>();
    const out: SearchItem[] = [];
    for (const it of [...items, ...activityItems]) {
      if (seen.has(it.href)) continue;
      seen.add(it.href);
      out.push(it);
    }
    return out;
  }, [items, activities, activityHrefBase]);

  // Defer the query used for filtering so fast typing doesn't block the input.
  // React keeps the previous filtered list visible until the new pass settles,
  // which is cheaper and smoother than a setTimeout-based debounce.
  const deferredQuery = useDeferredValue(query);

  const matches = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return [] as SearchItem[];
    return dedupedItems
      .filter((it) => it.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [dedupedItems, deferredQuery]);

  // Reset highlight when the query changes. Derived-state pattern (set during
  // render with a guard) avoids the cascading-render hit of doing this in an effect.
  if (prevQuery !== query) {
    setPrevQuery(query);
    setHighlight(0);
  }

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
            // First keystroke triggers the lazy activities fetch.
            void loadActivities();
          }}
          onFocus={() => {
            setOpen(true);
            // Pre-warm activities the moment the user focuses the box so
            // results are already there by the time they finish typing.
            void loadActivities();
          }}
          onKeyDown={onKeyDown}
          placeholder="Search projects..."
          className="h-10 w-[220px] rounded-full border border-border bg-muted/40 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background md:w-[280px] lg:w-[340px]"
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
