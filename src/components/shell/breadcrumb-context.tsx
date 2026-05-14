"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Map of URL segment → human label used by the topbar breadcrumb.
 * Keys are the *raw segments* that appear in the pathname (typically UUIDs).
 * Values are the user-facing labels we want to show in their place
 * (e.g. project name, activity title, phase title).
 *
 * Two layers feed this:
 *  - Layout-level *seeds*: project + client maps the shell already loads
 *    for the sidebar/search. No extra database calls.
 *  - Page-level *overrides*: nested detail pages register the entity name
 *    they already fetched via the `<SetBreadcrumbLabels>` component.
 */
type LabelMap = Record<string, string>;

type Ctx = {
  labels: LabelMap;
  setLabels: (next: LabelMap) => void;
};

const BreadcrumbCtx = createContext<Ctx | null>(null);

export function BreadcrumbProvider({
  seed,
  children,
}: {
  seed?: LabelMap;
  children: ReactNode;
}) {
  // Page-registered overrides. Layout seeds are merged in below so that a
  // page can still override what the shell knows about (e.g. a renamed
  // project — the page has the freshest data).
  const [overrides, setOverrides] = useState<LabelMap>({});

  const setLabels = useCallback((next: LabelMap) => {
    setOverrides((prev) => {
      // Avoid useless re-renders if nothing changed.
      let changed = false;
      for (const k of Object.keys(next)) {
        if (prev[k] !== next[k]) {
          changed = true;
          break;
        }
      }
      if (!changed) return prev;
      return { ...prev, ...next };
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ labels: { ...(seed ?? {}), ...overrides }, setLabels }),
    [seed, overrides, setLabels],
  );

  return <BreadcrumbCtx.Provider value={value}>{children}</BreadcrumbCtx.Provider>;
}

export function useBreadcrumbLabels(): LabelMap {
  return useContext(BreadcrumbCtx)?.labels ?? {};
}

/**
 * Drop-in client component for nested pages. Renders nothing visually —
 * just registers the entity names the page already has in scope so the
 * topbar breadcrumb can show "Admin / Projects / Acme Onboarding / Team"
 * instead of "Admin / Projects / 5d8f2a... / Team".
 *
 * Usage (inside a server component is fine — this is a client island):
 *   <SetBreadcrumbLabels labels={{ [project.id]: project.name }} />
 */
export function SetBreadcrumbLabels({ labels }: { labels: LabelMap }) {
  const ctx = useContext(BreadcrumbCtx);
  // Serialize so the effect only fires when the actual values change, not
  // when the parent re-renders with a fresh object reference.
  const key = JSON.stringify(labels);
  useEffect(() => {
    if (!ctx) return;
    ctx.setLabels(labels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ctx]);
  return null;
}
