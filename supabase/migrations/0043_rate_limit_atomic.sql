-- 0043_rate_limit_atomic.sql
--
-- Fixes H-1: try_consume() (migration 0027) performed a non-atomic
-- read-modify-write — DELETE expired, SELECT count(*), then conditionally
-- INSERT — with no lock serialising concurrent callers. Under parallel
-- requests (trivial over HTTP/2) two transactions both read count < limit
-- and both INSERT, so the effective limit is multiplied by the request
-- concurrency. That defeats the brute-force / burn-through protection on the
-- security-sensitive buckets (pwd-verify, otp-verify, auth-callback,
-- pwd-reset, email-change, invite).
--
-- Fix: take a transaction-scoped advisory lock keyed on (bucket, key) at the
-- top of the function. Concurrent calls for the SAME (bucket, key) now
-- serialise on the lock, so the count-then-insert is effectively atomic.
-- Calls for DIFFERENT keys hash to different lock ids and do not contend, so
-- throughput for unrelated buckets/keys is unaffected. The lock is released
-- automatically at transaction end (each rpc call is its own transaction).

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
  -- Serialise concurrent callers for this exact (bucket, key). hashtextextended
  -- yields a stable bigint lock id. The ':' separator keeps the concatenation
  -- injective in (bucket, key) because bucket names never contain ':' (they are
  -- fixed app constants like 'pwd-verify'). A hash collision between two
  -- distinct keys would at worst briefly serialise two unrelated buckets —
  -- harmless for correctness. Released automatically at transaction (rpc) end.
  perform pg_advisory_xact_lock(
    hashtextextended(p_bucket || ':' || p_key, 0)
  );

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
  'Sliding-window rate limit (atomic via per-(bucket,key) advisory xact lock): if fewer than p_limit events exist for (bucket, key) in the past p_window_seconds, record one and return ok=true; otherwise return ok=false with retry_after_seconds.';
