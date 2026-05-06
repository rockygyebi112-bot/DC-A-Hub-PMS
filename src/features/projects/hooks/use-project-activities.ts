"use client";

import { useCallback, useEffect, useState } from "react";
import { listActivities } from "../data/queries";
import type { ProjectActivity } from "../domain/types";

interface UseProjectActivitiesReturn {
  activities: ProjectActivity[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useProjectActivities(
  projectId: string | undefined,
): UseProjectActivitiesReturn {
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(!!projectId);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setActivities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listActivities(projectId);
      setActivities(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setActivities([]);
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const data = await listActivities(projectId);
        if (!active) return;
        setActivities(data);
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
  }, [projectId]);

  return { activities, loading, error, refresh };
}
