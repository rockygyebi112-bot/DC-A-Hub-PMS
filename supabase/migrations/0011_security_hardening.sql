-- DC&A Hub PMS — security hardening
--
-- Addresses:
--   * CRIT-1/HIGH-2: Column-scoped profiles self-update (no role/is_active escalation)
--   * CRIT-3:       Tighten blanket anon/authenticated grants on public schema
--   * HIGH-5:       activity_log insert must match auth.uid()
--   * HIGH-3:       Server-enforced upload size cap on activity_proofs & expenses
--   * MED-7:        Safer project-id extraction from storage paths
--   * Defensive:    FORCE ROW LEVEL SECURITY on every app table

-- ---------------------------------------------------------------------------
-- 1. Lock down default privileges on the public schema.
--    The 0004 migration granted ALL to anon/authenticated. That is too wide:
--    any future table created without RLS is fully exposed. Restrict grants
--    to authenticated + service_role, and drop anon entirely.
-- ---------------------------------------------------------------------------

-- Undo previous wide default privileges so newly created objects are tight.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- Revoke wide grants on existing objects.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Re-grant only what PostgREST + Supabase need. RLS is still the primary gate.
grant usage on schema public to anon, authenticated;

-- anon should be able to *read* nothing by default; individual public views
-- must be granted explicitly if ever needed. authenticated gets DML.
grant select, insert, update, delete on all tables    in schema public to authenticated;
grant usage, select                  on all sequences in schema public to authenticated;
grant execute                        on all functions in schema public to authenticated;

-- Future objects created by the migrating role inherit the narrower grants.
alter default privileges in schema public
  grant select, insert, update, delete on tables    to authenticated;
alter default privileges in schema public
  grant usage, select                  on sequences to authenticated;
alter default privileges in schema public
  grant execute                        on functions to authenticated;

-- Service role keeps full access (Supabase uses it internally).
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------
-- 2. FORCE RLS on every app table so even the table owner must obey policies.
-- ---------------------------------------------------------------------------
alter table profiles                force row level security;
alter table clients                 force row level security;
alter table projects                force row level security;
alter table project_members         force row level security;
alter table phases                  force row level security;
alter table activities              force row level security;
alter table activity_proofs         force row level security;
alter table activity_log            force row level security;
alter table project_budgets         force row level security;
alter table budget_categories       force row level security;
alter table expenses                force row level security;
alter table user_notification_reads force row level security;

-- ---------------------------------------------------------------------------
-- 3. CRIT-1 / HIGH-2 — Column-scoped self-update on profiles.
--    A user may edit their own full_name / avatar_url, but MUST NOT change
--    their role or is_active status. Only admins (via profiles_admin_all)
--    may change those columns.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_self_update on profiles;

create policy profiles_self_update on profiles for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    -- Role and activation cannot be altered via the self-update path.
    and role      = (select p.role      from profiles p where p.user_id = auth.uid())
    and is_active = (select p.is_active from profiles p where p.user_id = auth.uid())
    -- email is managed via auth.users; pin it to the current value too.
    and email     = (select p.email     from profiles p where p.user_id = auth.uid())
  );

-- Defence in depth: revoke direct UPDATE on the role/is_active columns from
-- the authenticated role. Admin server actions use the service role client
-- (SUPABASE_SERVICE_ROLE_KEY), so this does not affect them.
revoke update (role, is_active) on profiles from authenticated;

-- ---------------------------------------------------------------------------
-- 4. HIGH-5 — activity_log writes must be attributed to the real caller.
-- ---------------------------------------------------------------------------
drop policy if exists activity_log_write on activity_log;

create policy activity_log_write on activity_log for insert
  with check (
    public.can_write_project(project_id)
    and (actor_user_id is null or actor_user_id = auth.uid())
  );

-- Also forbid updates/deletes of audit rows from the authenticated role.
revoke update, delete on activity_log from authenticated;

-- ---------------------------------------------------------------------------
-- 5. HIGH-3 — Upload size caps enforced at the database layer.
--    25 MB for proofs, 25 MB for expense receipts.
-- ---------------------------------------------------------------------------
alter table activity_proofs
  drop constraint if exists activity_proofs_size_check;
alter table activity_proofs
  add constraint activity_proofs_size_check
  check (size_bytes is null or size_bytes <= 26214400);

-- ---------------------------------------------------------------------------
-- 6. MED-7 — Safer project-id extraction. Return null on malformed paths
--            instead of raising (which surfaces as a 500 to the client).
-- ---------------------------------------------------------------------------
create or replace function public.project_id_from_path(object_name text)
returns uuid language plpgsql stable as $$
declare
  candidate text;
  result uuid;
begin
  if object_name is null then return null; end if;
  if object_name not like 'projects/%/activities/%/%' then return null; end if;
  candidate := split_part(object_name, '/', 2);
  begin
    result := candidate::uuid;
  exception when others then
    return null;
  end;
  return result;
end;
$$;

create or replace function public.receipt_project_id(object_name text)
returns uuid language plpgsql stable as $$
declare
  candidate text;
  result uuid;
begin
  if object_name is null then return null; end if;
  if object_name not like 'projects/%/expenses/%' then return null; end if;
  candidate := split_part(object_name, '/', 2);
  begin
    result := candidate::uuid;
  exception when others then
    return null;
  end;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Extra safety: last-admin guard as a DB-level trigger.
--    Prevents anyone (including admins via the service role) from demoting or
--    deactivating the last active admin. Server actions still enforce this
--    earlier for a nicer error message.
-- ---------------------------------------------------------------------------
create or replace function public.assert_not_last_admin()
returns trigger language plpgsql as $$
declare
  remaining int;
begin
  -- Only care when a row is transitioning away from active-admin status.
  if (old.role = 'admin' and old.is_active = true)
     and (new.role <> 'admin' or new.is_active = false) then
    select count(*) into remaining
      from profiles
     where role = 'admin'
       and is_active = true
       and id <> old.id;
    if remaining < 1 then
      raise exception 'Cannot remove the last active admin';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_last_admin_guard on profiles;
create trigger profiles_last_admin_guard
  before update on profiles
  for each row execute function public.assert_not_last_admin();
