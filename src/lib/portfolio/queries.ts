import { createClient } from "@/lib/supabase/client";
import type {
  AttentionRow,
  DeliveryTrendPoint,
  PortfolioHealth,
  Timeframe,
  WorkloadRow,
} from "./types";

export async function fetchPortfolioHealth(
  programSlug: string | null,
): Promise<PortfolioHealth> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("rpc_portfolio_health", {
    p_program_slug: programSlug,
  });
  if (error) throw error;
  // RPC returns a set with one row.
  const row = (data as PortfolioHealth[] | null)?.[0];
  return (
    row ?? {
      active_projects: 0,
      done_projects: 0,
      on_track_count: 0,
      at_risk_or_blocked: 0,
      overdue_activities: 0,
    }
  );
}

export async function fetchAttentionRows(
  programSlug: string | null,
  limit = 10,
): Promise<AttentionRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    "rpc_projects_requiring_attention",
    { p_program_slug: programSlug, p_limit: limit },
  );
  if (error) throw error;
  return (data ?? []) as AttentionRow[];
}

export async function fetchDeliveryTrend(
  programSlug: string | null,
  timeframe: Timeframe,
): Promise<DeliveryTrendPoint[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("rpc_delivery_trend", {
    p_program_slug: programSlug,
    p_timeframe: timeframe,
  });
  if (error) throw error;
  return (data ?? []) as DeliveryTrendPoint[];
}

export async function fetchWorkload(
  programSlug: string | null,
  limit = 10,
): Promise<WorkloadRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("rpc_workload_distribution", {
    p_program_slug: programSlug,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as WorkloadRow[];
}
