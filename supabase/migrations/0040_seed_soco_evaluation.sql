-- 0040_seed_soco_evaluation.sql
--
-- Seeds the SOCO Midterm Review evaluation + the Household Survey instrument
-- + the v1 dashboard spec (6 KPIs, 6 sections).
--
-- Reconciled 2026-05 against "MTR Harmonized Modules_HH_Ghana_Update_20260519":
--   * schema_config: age fixed s1_a2 -> s1_a5; cluster (s0_a6) added.
--   * dashboard spec: chart fields realigned to the questionnaire's actual
--     section codes (s0-s6). Old s3_c / s5_* / s6_* / s7_* references removed.
--   Every field code below is anchored on an explicit skip-logic reference in
--   the questionnaire (no inferred guesses).
--
-- This migration is idempotent: every insert is guarded by a NOT EXISTS check
-- on a stable slug or natural key. Re-running is safe.
--
-- The migration assumes a project with a known marker exists (matched by name
-- LIKE 'SOCO%'). If no such project exists yet, the seed is skipped — admin
-- can re-trigger by creating the project and re-running this migration via
-- an idempotent helper, or by inserting the rows by hand.

do $$
declare
  soco_project_id uuid;
  soco_eval_id uuid;
  hh_instrument_id uuid;
begin
  select id into soco_project_id from projects where name ilike 'SOCO%' order by created_at asc limit 1;
  if soco_project_id is null then
    raise notice 'No SOCO project found; skipping seed';
    return;
  end if;

  select id into soco_eval_id from evaluations where slug = 'soco-midterm-review';
  if soco_eval_id is null then
    insert into evaluations (project_id, name, slug, status, collection_target_n, collection_started_at)
    values (soco_project_id, 'SOCO Midterm Review', 'soco-midterm-review', 'collecting', 2000, now())
    returning id into soco_eval_id;
  end if;

  select id into hh_instrument_id
    from evaluation_instruments
    where evaluation_id = soco_eval_id and kind = 'hh';
  if hh_instrument_id is null then
    insert into evaluation_instruments (evaluation_id, kind, name, kobo_form_id, schema_config)
    values (
      soco_eval_id, 'hh', 'Household Survey', 'TBD_VIA_ADMIN_UI',
      '{
        "s0_a4": "region",
        "s0_a5": "district",
        "s0_a6": "cluster",
        "s0_a7": "community",
        "s1_a1": "gender",
        "s1_a5": "age"
      }'::jsonb
    )
    returning id into hh_instrument_id;
  end if;

  if not exists (
    select 1 from evaluation_dashboard_configs
    where evaluation_id = soco_eval_id and is_active = true
  ) then
    insert into evaluation_dashboard_configs (evaluation_id, version, spec, is_active)
    values (
      soco_eval_id, 1,
      '{
        "kpis": [
          { "id": "collected_vs_target", "label": "Collected vs target",
            "instrument": "hh", "numerator": { "approved": true },
            "denominator": "target_n", "format": "fraction" },
          { "id": "in_qc_queue", "label": "Awaiting QC",
            "instrument": "hh", "numerator": { "qc_status": "pending" },
            "denominator": "all_responses", "format": "count" },
          { "id": "districts_active", "label": "Districts active",
            "instrument": "hh", "numerator": { "distinct": "district" },
            "denominator": "districts_total", "format": "fraction" },
          { "id": "fm_split", "label": "Female / Male split",
            "instrument": "hh", "numerator": { "field": "gender", "eq": "female" },
            "denominator": "all_responses", "format": "percent" },
          { "id": "refusal_rate", "label": "Refusal + replacement rate",
            "instrument": "hh",
            "numerator": { "qc_status_in": ["cancelled_redo","cancelled_dropped"] },
            "denominator": "all_responses", "format": "percent" },
          { "id": "qc_approval_rate", "label": "QC approval rate",
            "instrument": "hh", "numerator": { "qc_status": "approved" },
            "denominator": "qc_decided", "format": "percent" }
        ],
        "sections": [
          { "id": "reach", "title": "Project reach & participation",
            "charts": [
              { "type": "donut", "field": "s3_a1", "title": "Heard of SOCO?" },
              { "type": "bar_pct", "field": "s3_a2", "title": "How they heard",
                "filter": { "field": "s3_a1", "eq": 1 } },
              { "type": "stacked_bar", "field": "s3_a8", "by": "gender",
                "title": "Felt involved in meeting decisions (by gender)" }
            ]
          },
          { "id": "meetings", "title": "Community meetings & CPIC",
            "charts": [
              { "type": "donut", "field": "s3_a3", "title": "SOCO meeting held in community" },
              { "type": "donut", "field": "s3_a4", "title": "Personally attended a meeting",
                "filter": { "field": "s3_a3", "eq": 1 } },
              { "type": "donut", "field": "s3_a10", "title": "CPIC exists in community" }
            ]
          },
          { "id": "investments", "title": "Infrastructure investments",
            "charts": [
              { "type": "horizontal_bar", "field": "inv_familiarity", "title": "Familiarity by investment" },
              { "type": "horizontal_bar", "field": "inv_satisfaction", "title": "Satisfaction by investment" },
              { "type": "bar_pct", "field": "s3_b3", "title": "How often investment is used" },
              { "type": "donut", "field": "s3_b19", "title": "Investment benefited household" }
            ]
          },
          { "id": "services", "title": "Service satisfaction & access",
            "charts": [
              { "type": "donut", "field": "s2_a4", "title": "Pays for drinking water" },
              { "type": "bar_pct", "field": "s2_b1", "title": "Market location" },
              { "type": "donut", "field": "s2_d2", "title": "Household member fell seriously ill" }
            ]
          },
          { "id": "civic", "title": "Civic engagement",
            "charts": [
              { "type": "donut", "field": "s4_b1", "title": "Public meeting held (past 12 months)" },
              { "type": "donut", "field": "s4_b2", "title": "Personally attended a community meeting",
                "filter": { "field": "s4_b1", "eq": 1 } },
              { "type": "donut", "field": "s4_b7", "title": "Participated in community works" }
            ]
          },
          { "id": "shocks", "title": "Conflict & climate shocks",
            "charts": [
              { "type": "bar_pct", "field": "s5_a1", "title": "Community conflict frequency" },
              { "type": "stacked_bar", "field": "s5_b6", "by": "district",
                "title": "SOCO effect on coping with drought (by district)" }
            ]
          }
        ],
        "disaggregations": {
          "geography": { "fields": ["region","district","community"],
                         "labels": ["Region","District","Community"] },
          "gender": { "field": "gender" },
          "soco_exposure": {
            "Heard of SOCO": { "field": "s3_a1", "eq": 1 },
            "Attended a meeting": { "field": "s3_a4", "eq": 1 },
            "Familiar with an investment": { "field": "s3_b2", "eq": 1 }
          }
        }
      }'::jsonb,
      true
    );
  end if;
end$$;
