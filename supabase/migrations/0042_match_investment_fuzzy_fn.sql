-- 0042_match_investment_fuzzy_fn.sql
--
-- Helper RPC for fuzzy-matching MIS investments by name within a community.
-- Returns rows whose similarity >= threshold, ordered by similarity desc.

create or replace function public.match_mis_investment_fuzzy(
  p_evaluation_id uuid,
  p_community text,
  p_raw_name text,
  p_threshold float
)
returns table(id uuid, investment_name text, similarity real)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.investment_name, similarity(m.investment_name, p_raw_name) as similarity
  from mis_investments m
  where m.evaluation_id = p_evaluation_id
    and lower(m.community) = lower(p_community)
    and similarity(m.investment_name, p_raw_name) >= p_threshold
  order by similarity(m.investment_name, p_raw_name) desc
  limit 5;
$$;

revoke execute on function public.match_mis_investment_fuzzy(uuid, text, text, float) from public;
revoke execute on function public.match_mis_investment_fuzzy(uuid, text, text, float) from anon;
grant execute on function public.match_mis_investment_fuzzy(uuid, text, text, float) to service_role;
