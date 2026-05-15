"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { THEME_STORAGE_KEY } from "./script";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPreference(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolve(theme: Theme, system: ResolvedTheme): ResolvedTheme {
  return theme === "system" ? system : theme;
}

function applyClass(resolved: ResolvedTheme) {
  const c = document.documentElement.classList;
  c.remove("light", "dark");
  c.add(resolved);
  document.documentElement.style.colorScheme = resolved;
}

/**
 * App-wide theme provider. Mirrors the minimal next-themes API
 * (`theme`, `resolvedTheme`, `setTheme`) without rendering a <script> from
 * inside a client component — the pre-paint script lives in `layout.tsx` so
 * React 19 doesn't warn.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Both server and client start at "system" so SSR output matches the
  // initial client render. The localStorage value (if any) is restored in
  // the useEffect below, which runs after hydration.
  const [theme, setThemeState] = useState<Theme>("system");
  const [system, setSystem] = useState<ResolvedTheme>("light");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (raw === "light" || raw === "dark" || raw === "system") {
        setThemeState(raw);
      }
    } catch {
      // localStorage may be blocked (private mode, quota) — fine, use default.
    }
    setSystem(systemPreference());

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) =>
      setSystem(e.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    // Sync across tabs.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      const v = e.newValue as Theme | null;
      if (v === "light" || v === "dark" || v === "system") setThemeState(v);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const resolvedTheme = resolve(theme, system);

  // Keep the <html> class in sync. The pre-paint script set the class
  // already; this re-applies it after any toggle.
  useEffect(() => {
    applyClass(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Match next-themes' permissive contract — toggle components imported
    // outside the provider get sane defaults instead of throwing.
    return { theme: "system", resolvedTheme: "light", setTheme: () => {} };
  }
  return ctx;
}
