"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchItem } from "./topbar-search";

type SearchableActivity = {
  id: string;
  name: string;
  project_id: string;
  project_name: string;
  phase_name: string | null;
};

/**
 * Global Cmd/Ctrl+K command palette. Opens a centered modal with a
 * search input that filters across the same items the topbar search
 * already uses (projects + clients + lazily-loaded activities). The
 * palette is keyboard-first: ↑/↓ to navigate, Enter to commit, Esc to
 * close.
 *
 * Mounted once globally via AppShell so every page exposes the
 * shortcut without per-page wiring.
 */
export function CommandPalette({
  items,
  activityHrefBase = "/workspace",
}: {
  items: SearchItem[];
  activityHrefBase?: "/workspace" | "/portal";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [activities, setActivities] = useState<SearchableActivity[]>([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadActivities = useCallback(async () => {
    if (activitiesLoaded) return;
    setActivitiesLoaded(true);
    try {
      const res = await fetch("/api/search/activities", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as SearchableActivity[];
      if (Array.isArray(data)) setActivities(data);
    } catch {
      // best-effort
    }
  }, [activitiesLoaded]);

  // Open the palette and run all entry side-effects (focus input, warm
  // activities). Centralised so we don't sync these in an effect.
  const openPalette = useCallback(() => {
    setOpen(true);
    setHighlight(0);
    void loadActivities();
    // Focus on next tick once the dialog DOM exists.
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [loadActivities]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlight(0);
  }, []);

  // Global Cmd/Ctrl+K toggle, plus a custom event so other components
  // (e.g. a topbar button) can open the palette without prop drilling.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isToggle =
        (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
      if (isToggle) {
        e.preventDefault();
        if (open) closePalette();
        else openPalette();
      } else if (e.key === "Escape" && open) {
        closePalette();
      }
    }
    function onCustom() {
      if (open) closePalette();
      else openPalette();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("cmdk:toggle", onCustom as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("cmdk:toggle", onCustom as EventListener);
    };
  }, [open, openPalette, closePalette]);

  const merged = useMemo(() => {
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

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merged.slice(0, 12);
    return merged
      .filter(
        (it) =>
          it.label.toLowerCase().includes(q) ||
          (it.group ?? "").toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [merged, query]);

  const commit = useCallback(
    (item: SearchItem) => {
      closePalette();
      router.push(item.href);
    },
    [router, closePalette],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[14vh]"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close command palette"
        onClick={closePalette}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      />
      {/* Panel */}
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border bg-popover shadow-2xl ring-1 ring-foreground/5">
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search projects, clients, activities..."
            className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            Esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-1">
          {matches.length === 0 ? (
            <div className="px-3 py-10 text-center text-xs text-muted-foreground">
              {query
                ? <>No matches for &quot;{query}&quot;</>
                : "Start typing to search."}
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
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commit(item)}
                      className={cn(
                        "group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "bg-accent text-foreground"
                          : "hover:bg-accent",
                      )}
                    >
                      <span className="min-w-0 truncate">{item.label}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {item.group ? (
                          <span className="hidden text-[11px] text-muted-foreground sm:inline">
                            {item.group}
                          </span>
                        ) : null}
                        <ArrowRight
                          className={cn(
                            "size-3.5 text-muted-foreground transition-opacity",
                            active ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">↑</kbd>
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-2">
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">Enter</kbd>
            open
          </span>
          <span className="hidden items-center gap-2 sm:flex">
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">⌘</kbd>
            <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">K</kbd>
            toggle
          </span>
        </div>
      </div>
    </div>
  );
}
