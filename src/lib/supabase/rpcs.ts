import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Typed wrappers for the RPCs introduced in migration 0029. The generated
// `Database` type does not know about them until `npm run db:types` is re-run
// against the linked Supabase project; delete this module after regen and
// move callers onto `sb.rpc("...")` directly.

type AnyRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
};

function untyped(sb: SupabaseClient<Database>): AnyRpcClient {
  return sb as unknown as AnyRpcClient;
}

type PhaseRow = Database["public"]["Tables"]["phases"]["Row"];
type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
type BudgetCategoryRow = Database["public"]["Tables"]["budget_categories"]["Row"];
type ProjectMemberRow = Database["public"]["Tables"]["project_members"]["Row"];

export type RpcResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

export async function insertPhaseOrdered(
  sb: SupabaseClient<Database>,
  args: {
    project_id: string;
    name: string;
    description?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  },
): Promise<RpcResult<PhaseRow>> {
  const res = await untyped(sb).rpc("insert_phase_ordered", {
    p_project_id: args.project_id,
    p_name: args.name,
    p_description: args.description ?? null,
    p_start_date: args.start_date ?? null,
    p_end_date: args.end_date ?? null,
  });
  return res as RpcResult<PhaseRow>;
}

export async function insertActivityOrdered(
  sb: SupabaseClient<Database>,
  args: {
    phase_id: string;
    name: string;
    description?: string | null;
    deliverable?: string | null;
    responsible?: string | null;
    status?: string;
    planned_date?: string | null;
    completed_date?: string | null;
    created_by?: string | null;
  },
): Promise<RpcResult<ActivityRow>> {
  const res = await untyped(sb).rpc("insert_activity_ordered", {
    p_phase_id: args.phase_id,
    p_name: args.name,
    p_description: args.description ?? null,
    p_deliverable: args.deliverable ?? null,
    p_responsible: args.responsible ?? null,
    p_status: args.status ?? "not_started",
    p_planned_date: args.planned_date ?? null,
    p_completed_date: args.completed_date ?? null,
    p_created_by: args.created_by ?? null,
  });
  return res as RpcResult<ActivityRow>;
}

export async function insertBudgetCategoryOrdered(
  sb: SupabaseClient<Database>,
  args: {
    project_id: string;
    name: string;
    allocated_amount?: number;
  },
): Promise<RpcResult<BudgetCategoryRow>> {
  const res = await untyped(sb).rpc("insert_budget_category_ordered", {
    p_project_id: args.project_id,
    p_name: args.name,
    p_allocated_amount: args.allocated_amount ?? 0,
  });
  return res as RpcResult<BudgetCategoryRow>;
}

export async function transferProjectManager(
  sb: SupabaseClient<Database>,
  args: { project_id: string; member_id: string },
): Promise<RpcResult<null>> {
  const res = await untyped(sb).rpc("transfer_project_manager", {
    p_project_id: args.project_id,
    p_member_id: args.member_id,
  });
  return res as RpcResult<null>;
}

export async function addProjectMemberAsManager(
  sb: SupabaseClient<Database>,
  args: { project_id: string; user_id: string },
): Promise<RpcResult<ProjectMemberRow>> {
  const res = await untyped(sb).rpc("add_project_member_as_manager", {
    p_project_id: args.project_id,
    p_user_id: args.user_id,
  });
  return res as RpcResult<ProjectMemberRow>;
}
