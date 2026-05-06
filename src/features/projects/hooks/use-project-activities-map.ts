"use client";

import { useCallback, useEffect, useState } from "react";
import { listActivities } from "../data/queries";
import type { ProjectActivity } from "../domain/types";

interface UseProjectActivitiesMapReturn {
  activitiesMap: Record<string, ProjectActivity[]>;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useProjectActivitiesMap(
  projectIds: string[],
): UseProjectActivitiesMapReturn {
  const [activitiesMap, setActivitiesMap] = useState<
    Record<string, ProjectActivity[]>
  >({});
  const [loading, setLoading] = useState(projectIds.length > 0);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (projectIds.length === 0) {
      setActivitiesMap({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const entries = await Promise.all(
        projectIds.map(async (id) => [id, await listActivities(id)] as const),
      );
      setActivitiesMap(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [projectIds.join(",")]);

  useEffect(() => {
    if (projectIds.length === 0) {
      setActivitiesMap({});
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const entries = await Promise.all(
          projectIds.map(async (id) => [id, await listActivities(id)] as const),
        );
        if (!active) return;
        setActivitiesMap(Object.fromEntries(entries));
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectIds.join(",")]);

  return { activitiesMap, loading, error, refresh };
}
