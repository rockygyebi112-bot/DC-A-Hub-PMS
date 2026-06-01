-- 0042_atomic_fixes.sql
--
-- Correctness/atomicity hardening surfaced by the staff-engineer review:
--
--   1) replace_mis_investments — the MIS upload route deleted the existing
--      dataset and then bulk-inserted in two separate service-role calls. A
--      failure on the insert left the evaluation with ZERO rows and no way to
--      recover the prior data. Wrap delete+insert in one SECURITY DEFINER
--      function so it runs as a single atomic transaction (rollback on error).
--
--   2) set_dashboard_spec — setDashboardSpec did read-modify-write on the
--      version number across three separate statements with no transaction or
--      lock. Two concurrent admin saves could either collide on a duplicate
--      version or briefly leave the evaluation with NO active config (blank
--      dashboard for every viewer). Serialize per-evaluation with an advisory
--      lock and do the whole swap in one function call.
--
--   3) evaluation_responses column grants — the staff-update RLS policy claimed
--      "only qc_status fields" but RLS cannot constrain columns, so any staff
--      member could rewrite the raw response payload via a direct supabase-js
--      UPDATE. Mirror the profiles(role,is_active) pattern: REVOKE UPDATE on the
--      table from authenticated and re-GRANT it on only the QC columns. The
--      ingestion pipeline writes via SERVICE_ROLE and is unaffected.

-- ---------------------------------------------------------------------------
-- 1. Atomic MIS replace.
-- ---------------------------------------------------------------------------
create or replace function public.replace_mis_investments(
  p_evaluation_id uuid,
  p_rows jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  if p_evaluation_id is null then
    raise exception 'evaluation_id is required';
  end if;
  if not exists (select 1 from evaluations where id = p_evaluation_id) then
    raise exception 'evaluation not found';
  end if;

  -- Function body is a single transaction: if the insert below raises, the
  -- delete is rolled back and the prior dataset survives.
  delete from mis_investments where evaluation_id = p_evaluation_id;

  insert into mis_investments
    (evaluation_id, community, district, investment_type, investment_name, completion_date)
  select
    p_evaluation_id,
    r.community,
    r.district,
    r.investment_type,
    r.investment_name,
    r.completion_date
  from jsonb_to_recordset(p_rows) as r(
    community text,
    district text,
    investment_type text,
    investment_name text,
    completion_date date
  );

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on function public.replace_mis_investments(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_mis_investments(uuid, jsonb) to service_role;

comment on function public.replace_mis_investments(uuid, jsonb) is
  'Atomically replace all mis_investments rows for an evaluation. service_role only (called from the MIS upload route, which has already authenticated an admin). Returns the inserted row count.';

-- ---------------------------------------------------------------------------
-- 2. Atomic dashboard-spec version bump + active swap.
-- ---------------------------------------------------------------------------
create or replace function public.set_dashboard_spec(
  p_evaluation_id uuid,
  p_spec jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
begin
  -- Preserve the admin-only authorization the previous RLS policy enforced.
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from evaluations where id = p_evaluation_id) then
    raise exception 'evaluation not found';
  end if;

  -- Serialize concurrent saves for the SAME evaluation so the version read and
  -- the single-active-config swap cannot interleave. Released at txn end.
  perform pg_advisory_xact_lock(hashtextextended(p_evaluation_id::text, 0));

  -- Version monotonically across ALL prior configs (not just the active one)
  -- so a re-activated old version can't reuse a number.
  select coalesce(max(version), 0) + 1 into next_version
    from evaluation_dashboard_configs
   where evaluation_id = p_evaluation_id;

  update evaluation_dashboard_configs
     set is_active = false
   where evaluation_id = p_evaluation_id and is_active = true;

  insert into evaluation_dashboard_configs (evaluation_id, version, spec, is_active)
  values (p_evaluation_id, next_version, p_spec, true);

  return next_version;
end;
$$;

revoke all on function public.set_dashboard_spec(uuid, jsonb) from public, anon;
grant execute on function public.set_dashboard_spec(uuid, jsonb) to authenticated, service_role;

comment on function public.set_dashboard_spec(uuid, jsonb) is
  'Atomically deactivate the current dashboard config and insert a new one at version+1, serialized per evaluation. Admin-only (checked via is_admin()).';

-- ---------------------------------------------------------------------------
-- 3. Column-scoped UPDATE on evaluation_responses.
--    Staff/admins may only change the QC columns via the authenticated role.
--    The ingestion pipeline (SERVICE_ROLE) is unaffected by column grants.
-- ---------------------------------------------------------------------------
revoke update on evaluation_responses from authenticated;
grant update (qc_status, qc_checked_at, qc_checked_by) on evaluation_responses to authenticated;
