-- 0027_rate_limit.sql
--
-- Addresses C-4: every auth-sensitive endpoint (password verify, password
-- reset, invite, email change) was unrate-limited. An attacker with one
-- valid session could brute-force the bound user's password by hammering
-- requestProofAccess / unlockProjectDocuments / updateMyPassword /
-- updateMyEmail; password-reset and invite endpoints could be used to
-- flood Resend or enumerate.
--
-- Implementation:
--   * rate_limit_events       — append-only log of consumed slots per
--                               (bucket, key) pair. Old rows are pruned
--                               by try_consume on each call.
--   * try_consume(bucket,key,limit_count,window_seconds) — SECURITY DEFINER
--                               function: counts events inside the window
--                               and either inserts a new event (returning
--                               true) or returns false. Atomic per call
--                               via a single SQL transaction.
--   * password_verify_attempts — separate audit table, every password
--                                re-auth attempt is logged with success
--                                bool, user, ip, user-agent.

create table if not exists rate_limit_events (
  id           bigserial primary key,
  bucket       text not null,
  key          text not null,
  created_at   timestamptz not null default now()
);

create index if not exists rate_limit_events_bucket_key_created_idx
  on rate_limit_events (bucket, key, created_at desc);

-- The function lives in `public` so the service-role client can call it
-- via supabase.rpc(). It's the only writer/reader of rate_limit_events;
-- we leave RLS off on that table because no end-user role should ever
-- read it. Direct table access is locked down via revoke below.
alter table rate_limit_events enable row level security;
revoke all on rate_limit_events from authenticated, anon;

create or replace function public.try_consume(
  p_bucket text,
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns table (ok boolean, retry_after_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_oldest timestamptz;
begin
  -- Prune events older than the window. Cheap: indexed scan + small
  -- delete, bounded by traffic per (bucket,key).
  delete from rate_limit_events
    where bucket = p_bucket
      and key = p_key
      and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*), min(created_at)
    into v_count, v_oldest
    from rate_limit_events
   where bucket = p_bucket
     and key = p_key;

  if v_count >= p_limit then
    return query select
      false,
      greatest(
        1,
        p_window_seconds - extract(epoch from (now() - v_oldest))::int
      );
    return;
  end if;

  insert into rate_limit_events (bucket, key) values (p_bucket, p_key);
  return query select true, 0;
end;
$$;

comment on function public.try_consume(text, text, int, int) is
  'Sliding-window rate limit: if fewer than p_limit events exist for (bucket, key) in the past p_window_seconds, record one and return ok=true; otherwise return ok=false with retry_after_seconds.';

-- ---------------------------------------------------------------------------
-- Password verify audit
-- ---------------------------------------------------------------------------
create table if not exists password_verify_attempts (
  id           bigserial primary key,
  user_id      uuid references auth.users(id) on delete set null,
  email        text,
  success      boolean not null,
  ip_address   text,
  user_agent   text,
  context      text,
  created_at   timestamptz not null default now()
);

create index if not exists password_verify_attempts_user_idx
  on password_verify_attempts (user_id, created_at desc);
create index if not exists password_verify_attempts_email_idx
  on password_verify_attempts (email, created_at desc);

alter table password_verify_attempts enable row level security;
revoke all on password_verify_attempts from authenticated, anon;

-- Admins (server-side, service role) read this table for monitoring; no
-- end-user role should ever see it. RLS denies by default (no policies).
