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

type SearchableOrgs = {
  projects: { id: string; name: string }[];
  clients: { id: string; name: string }[];
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
  orgsHrefBase = "/admin",
  onSelect,
  autoFocus = false,
}: {
  /** Optional fallback list of items rendered before the lazy fetch resolves. */
  items?: SearchItem[];
  activityHrefBase?: "/workspace" | "/portal";
  /** Path prefix for clicking a project / client result. Admin shell uses
   *  `/admin`, portal/workspace surfaces use their respective project pages. */
  orgsHrefBase?: "/admin" | "/workspace" | "/portal";
  /** Called after a result is picked. Useful for closing a wrapping dialog. */
  onSelect?: () => void;
  /** Focus the input on mount (used when rendered inside a mobile dialog). */
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [prevQuery, setPrevQuery] = useState("");
  const [activities, setActivities] = useState<SearchableActivity[]>([]);
  const [orgs, setOrgs] = useState<SearchableOrgs | null>(null);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const [orgsLoaded, setOrgsLoaded] = useState(false);
  // Server-filtered results tagged with the query they belong to. The prewarmed
  // lists above are capped by recency, so a match outside that window could
  // never be found by client-side filtering alone — these fill that gap. We
  // key by query so stale results from a previous keystroke are ignored without
  // having to clear state synchronously inside the effect.
  const [serverResults, setServerResults] = useState<{
    q: string;
    items: SearchItem[];
  }>({ q: "", items: [] });
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

  const loadOrgs = useCallback(async () => {
    if (orgsLoaded) return;
    setOrgsLoaded(true);
    try {
      const res = await fetch("/api/search/orgs", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as SearchableOrgs;
      if (data && Array.isArray(data.projects) && Array.isArray(data.clients)) {
        setOrgs(data);
      }
    } catch {
      // best-effort: fallback `items` still drives the dropdown
    }
  }, [orgsLoaded]);

  // Defer the query used for filtering so fast typing doesn't block the input.
  // React keeps the previous filtered list visible until the new pass settles,
  // which is cheaper and smoother than a setTimeout-based debounce.
  const deferredQuery = useDeferredValue(query);

  // Defensive dedupe: project + client + activity hrefs can overlap (e.g. a
  // project shown twice via separate layout passes). Skip duplicates so React
  // doesn't warn about repeated keys when the dropdown renders.
  const dedupedItems = useMemo(() => {
    // Build orgs items from the lazy-loaded endpoint when available, else
    // fall back to the props-passed `items` so the first frame still works.
    const orgItems: SearchItem[] = orgs
      ? [
          ...orgs.projects.map((p) => ({
            href: `${orgsHrefBase}/projects/${p.id}`,
            label: p.name,
            group: "Projects",
          })),
          ...orgs.clients.map((c) => ({
            href: `${orgsHrefBase}/clients/${c.id}`,
            label: c.name,
            group: "Clients",
          })),
        ]
      : (items ?? []);

    const activityItems: SearchItem[] = activities.map((a) => ({
      href: `${activityHrefBase}/projects/${a.project_id}/activities/${a.id}`,
      label: a.name,
      group: `Activity · ${a.project_name}`,
    }));
    // Only merge server results that belong to the CURRENT query; stale ones
    // from a previous keystroke are dropped.
    const freshServerItems =
      serverResults.q === deferredQuery.trim() ? serverResults.items : [];

    const seen = new Set<string>();
    const out: SearchItem[] = [];
    // Server matches first so one outside the recency-capped prewarm wins the
    // dedupe and is guaranteed to appear.
    for (const it of [...freshServerItems, ...orgItems, ...activityItems]) {
      if (seen.has(it.href)) continue;
      seen.add(it.href);
      out.push(it);
    }
    return out;
  }, [
    items,
    orgs,
    activities,
    serverResults,
    deferredQuery,
    activityHrefBase,
    orgsHrefBase,
  ]);

  // Server-side search for the deferred query so matches beyond the recency-
  // capped prewarm are reachable. Aborts the previous in-flight request on each
  // change; failures fall back silently to the client-side filtered prewarm.
  useEffect(() => {
    const q = deferredQuery.trim();
    // Stale results are ignored by the query-tag check in dedupedItems, so we
    // don't need to clear state here (which would be a synchronous setState in
    // an effect). Just skip fetching for very short queries.
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const enc = encodeURIComponent(q);
    (async () => {
      try {
        const [aRes, oRes] = await Promise.all([
          fetch(`/api/search/activities?q=${enc}`, {
            cache: "no-store",
            signal: ctrl.signal,
          }),
          fetch(`/api/search/orgs?q=${enc}`, {
            cache: "no-store",
            signal: ctrl.signal,
          }),
        ]);
        const next: SearchItem[] = [];
        if (aRes.ok) {
          const data = (await aRes.json()) as SearchableActivity[];
          if (Array.isArray(data)) {
            for (const a of data) {
              next.push({
                href: `${activityHrefBase}/projects/${a.project_id}/activities/${a.id}`,
                label: a.name,
                group: `Activity · ${a.project_name}`,
              });
            }
          }
        }
        if (oRes.ok) {
          const data = (await oRes.json()) as SearchableOrgs;
          if (Array.isArray(data?.projects)) {
            for (const p of data.projects) {
              next.push({
                href: `${orgsHrefBase}/projects/${p.id}`,
                label: p.name,
                group: "Projects",
              });
            }
          }
          if (Array.isArray(data?.clients)) {
            for (const c of data.clients) {
              next.push({
                href: `${orgsHrefBase}/clients/${c.id}`,
                label: c.name,
                group: "Clients",
              });
            }
          }
        }
        setServerResults({ q, items: next });
      } catch {
        // Aborted or network error — keep whatever the prewarm gave us.
      }
    })();
    return () => ctrl.abort();
  }, [deferredQuery, activityHrefBase, orgsHrefBase]);

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
    onSelect?.();
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
            // First keystroke triggers the lazy fetches if they didn't fire
            // on focus (e.g. autofill or programmatic value set).
            void loadActivities();
            void loadOrgs();
          }}
          onFocus={() => {
            setOpen(true);
            // Pre-warm both lists the moment the user focuses the box so
            // results are already there by the time they finish typing.
            void loadActivities();
            void loadOrgs();
          }}
          onKeyDown={onKeyDown}
          placeholder="Search projects..."
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          className="h-10 w-full rounded-full border border-border bg-muted/40 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background md:w-[280px] lg:w-[340px]"
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
