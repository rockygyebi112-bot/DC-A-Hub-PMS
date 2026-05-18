-- 0029_atomic_invariants.sql
--
-- Phase 3 of the security/integrity hardening pass.
--
-- Problem 1: order_index is computed in the app with COUNT(*) then INSERT.
-- Two concurrent inserts under the same parent (project / phase) race to
-- the same order_index, silently producing duplicate positions in the
-- workplan. This migration adds partial unique indexes as a safety net AND
-- provides SECURITY INVOKER RPCs (`insert_phase_ordered`,
-- `insert_activity_ordered`, `insert_budget_category_ordered`) that compute
-- the next index inside a transaction-scoped advisory lock, eliminating
-- the race entirely.
--
-- Problem 2: setProjectManager / addTeamMembers do demote-then-promote in
-- two separate UPDATEs from the application server. If the process crashes
-- (or the second update fails for any reason) between the two calls, the
-- project is left with zero managers. RPC `transfer_project_manager`
-- collapses the two updates into a single function call, which Postgres
-- runs as one transaction — atomic by construction.
--
-- All RPCs are SECURITY INVOKER so existing RLS continues to apply.
-- Callers are admin server-actions running with the service-role client,
-- which already bypasses RLS, so this is purely a structure win.

-- ---------------------------------------------------------------------------
-- 1. Partial unique indexes on (parent_id, order_index)
--
-- Defence in depth: with the RPCs below, two concurrent callers serialise on
-- the advisory lock and never collide. But future app code may still issue a
-- naive INSERT; these indexes make that case fail loudly rather than corrupt
-- the order silently.

-- If existing rows contain duplicates these statements will fail; the
-- operator must dedupe before applying. The seed scripts and import path do
-- not currently produce duplicates outside of the race window.
create unique index if not exists phases_project_order_unique
  on phases (project_id, order_index);

create unique index if not exists activities_phase_order_unique
  on activities (phase_id, order_index);

create unique index if not exists budget_categories_project_order_unique
  on budget_categories (project_id, order_index);

-- ---------------------------------------------------------------------------
-- 2. Ordered-insert RPCs
--
-- Pattern: take a per-parent transaction-scoped advisory lock so concurrent
-- callers serialise, then INSERT computing order_index from the current max.
-- The lock is released automatically at transaction end (which, for a single
-- function call from the supabase-js client, is the end of that statement).

create or replace function public.insert_phase_ordered(
  p_project_id uuid,
  p_name text,
  p_description text default null,
  p_start_date date default null,
  p_end_date date default null
) returns phases
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row phases;
begin
  -- Serialise concurrent inserts under the same project. hashtextextended
  -- gives a stable bigint key from the (kind, parent) pair.
  perform pg_advisory_xact_lock(hashtextextended('phases:' || p_project_id::text, 0));

  insert into phases (project_id, name, description, start_date, end_date, order_index)
  values (
    p_project_id,
    p_name,
    nullif(p_description, ''),
    p_start_date,
    p_end_date,
    coalesce(
      (select max(order_index) from phases where project_id = p_project_id),
      -1
    ) + 1
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.insert_activity_ordered(
  p_phase_id uuid,
  p_name text,
  p_description text default null,
  p_deliverable text default null,
  p_responsible text default null,
  p_status text default 'not_started',
  p_planned_date date default null,
  p_completed_date date default null,
  p_created_by uuid default null
) returns activities
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row activities;
begin
  perform pg_advisory_xact_lock(hashtextextended('activities:' || p_phase_id::text, 0));

  insert into activities (
    phase_id, name, description, deliverable, responsible, status,
    planned_date, completed_date, created_by, order_index
  )
  values (
    p_phase_id,
    p_name,
    nullif(p_description, ''),
    nullif(p_deliverable, ''),
    nullif(p_responsible, ''),
    coalesce(p_status, 'not_started'),
    p_planned_date,
    p_completed_date,
    p_created_by,
    coalesce(
      (select max(order_index) from activities where phase_id = p_phase_id),
      -1
    ) + 1
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.insert_budget_category_ordered(
  p_project_id uuid,
  p_name text,
  p_allocated_amount numeric default 0
) returns budget_categories
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row budget_categories;
begin
  perform pg_advisory_xact_lock(hashtextextended('budget_categories:' || p_project_id::text, 0));

  insert into budget_categories (project_id, name, allocated_amount, order_index)
  values (
    p_project_id,
    p_name,
    coalesce(p_allocated_amount, 0),
    coalesce(
      (select max(order_index) from budget_categories where project_id = p_project_id),
      -1
    ) + 1
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Atomic project-manager transfer
--
-- Existing app code does:
--   UPDATE ... project_role = 'member' WHERE project_id = X AND project_role = 'manager';
--   UPDATE ... project_role = 'manager' WHERE id = Y;
-- in two separate calls. A crash between them leaves zero managers.
--
-- This function collapses the two into one transaction. The DB enforces
-- at-most-one-manager via a partial unique index (migration 0024); if the
-- target member is already the manager the function returns early without
-- touching anything.
--
-- Raises 'invalid_target_member' if the target row doesn't belong to the
-- project or is a viewer.

create or replace function public.transfer_project_manager(
  p_project_id uuid,
  p_member_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text;
begin
  -- Single advisory lock per project keeps concurrent PM transfers serial.
  perform pg_advisory_xact_lock(hashtextextended('pm-transfer:' || p_project_id::text, 0));

  select project_role into v_role
    from project_members
   where id = p_member_id
     and project_id = p_project_id;

  if v_role is null then
    raise exception 'invalid_target_member' using errcode = 'P0001';
  end if;
  if v_role = 'viewer' then
    raise exception 'viewer_cannot_be_manager' using errcode = 'P0001';
  end if;
  if v_role = 'manager' then
    return;
  end if;

  -- Demote any existing manager first to avoid tripping the partial unique
  -- index on (project_id) WHERE project_role = 'manager'.
  update project_members
     set project_role = 'member'
   where project_id = p_project_id
     and project_role = 'manager'
     and id <> p_member_id;

  update project_members
     set project_role = 'manager'
   where id = p_member_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Atomic "add team member as manager"
--
-- Mirror of transfer_project_manager but for the new-member case: insert
-- the new project_members row and (optionally) demote any current PM in
-- the same transaction. Returns the new row id.

create or replace function public.add_project_member_as_manager(
  p_project_id uuid,
  p_user_id uuid
) returns project_members
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row project_members;
begin
  perform pg_advisory_xact_lock(hashtextextended('pm-transfer:' || p_project_id::text, 0));

  -- Demote any existing manager FIRST so the new manager insert doesn't
  -- collide with the partial unique index.
  update project_members
     set project_role = 'member'
   where project_id = p_project_id
     and project_role = 'manager';

  insert into project_members (project_id, user_id, project_role)
  values (p_project_id, p_user_id, 'manager')
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. The RPCs are intentionally callable by both `authenticated`
-- (so user-scoped clients can use them under RLS) and `service_role` (the
-- admin client path used by team-management server actions).

grant execute on function public.insert_phase_ordered(uuid, text, text, date, date)
  to authenticated, service_role;
grant execute on function public.insert_activity_ordered(uuid, text, text, text, text, text, date, date, uuid)
  to authenticated, service_role;
grant execute on function public.insert_budget_category_ordered(uuid, text, numeric)
  to authenticated, service_role;
grant execute on function public.transfer_project_manager(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.add_project_member_as_manager(uuid, uuid)
  to authenticated, service_role;
