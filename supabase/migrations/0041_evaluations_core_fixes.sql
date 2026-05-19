-- 0041_evaluations_core_fixes.sql
--
-- Follow-up to 0035 picking up code-review fixes that arrived after 0035 was
-- already applied to the hosted DB. We can't re-edit 0035 itself (Supabase
-- tracks migrations by filename and would skip it on push), so the additions
-- live here. Numbered 0041 because 0035-0040 are reserved for the Part 2 main
-- migration sequence; this patch is a quality follow-up, not a phase
-- deliverable, so it logically sequences after the main set.
--
--   1. updated_at triggers for evaluations and evaluation_instruments
--      (matches the idiom established in 0033).
--   2. Sanity check that collection_target_n is positive when set.
--   3. Per-evaluation version uniqueness on evaluation_dashboard_configs so
--      two concurrent inserts can't both land as version N.
--   4. Soften the comment on evaluation_instruments.kobo_api_token_encrypted:
--      pgsodium-based encrypt/decrypt helpers land in 0039.

-- 1. updated_at triggers (reuse set_updated_at from 0001)
create trigger evaluations_updated_at before update on evaluations
  for each row execute function set_updated_at();
create trigger evaluation_instruments_updated_at before update on evaluation_instruments
  for each row execute function set_updated_at();

-- 2. collection_target_n sanity check
alter table evaluations
  add constraint evaluations_collection_target_n_positive_check
  check (collection_target_n is null or collection_target_n > 0);

-- 3. Per-evaluation version uniqueness
create unique index evaluation_dashboard_configs_eval_version_idx
  on evaluation_dashboard_configs(evaluation_id, version);

-- 4. Soften the encrypted-token column comment
comment on column evaluation_instruments.kobo_api_token_encrypted is
  'Kobo API token, encrypted at rest. Encrypt/decrypt helpers are added in 0039 (pgsodium-based). Application code must never read or write this column directly — use public.kobo_token_set / public.kobo_token_get.';
