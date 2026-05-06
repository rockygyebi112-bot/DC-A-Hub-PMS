"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Fetches active core-indicator option lists for a program and returns them
 * as a map keyed by the indicator name converted to snake_case (e.g. "Gender"
 * → "gender", "Age Bracket" → "age_bracket"). Forms use this to render their
 * Select options dynamically so edits made in Indicator Management take
 * effect immediately.
 *
 * Callers should fall back to their hardcoded constant if a key is missing
 * (e.g. while loading or if the indicator hasn't been seeded).
 */
export function useIndicatorOptions(programSlug: string) {
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: program } = await supabase
        .from("programs")
        .select("id")
        .eq("slug", programSlug)
        .single();

      if (!program) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data: indicators } = await supabase
        .from("indicators")
        .select("name, data_type, options, is_active")
        .eq("program_id", program.id)
        .eq("is_core", true)
        .eq("is_active", true)
        .eq("data_type", "categorical");

      if (cancelled) return;

      const map: Record<string, string[]> = {};
      for (const ind of indicators ?? []) {
        const key = (ind.name as string)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
        if (Array.isArray(ind.options)) {
          map[key] = ind.options as string[];
        }
      }
      setOptions(map);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [programSlug]);

  return { options, loading };
}

/** @deprecated Use useIndicatorOptions instead (renamed for clarity) */
export const useCoreIndicatorOptions = useIndicatorOptions;
