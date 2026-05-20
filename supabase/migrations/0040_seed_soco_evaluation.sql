-- 0040_seed_soco_evaluation.sql
--
-- Seeds the SOCO Midterm Review evaluation + the Household Survey instrument
-- + the v1 dashboard spec (6 KPIs, 6 sections).
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
        "s0_a7": "community",
        "s1_a1": "gender",
        "s1_a2": "age"
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
                "title": "Felt involved (by gender)" }
            ]
          },
          { "id": "investments", "title": "Infrastructure investments",
            "charts": [
              { "type": "horizontal_bar", "field": "inv_familiarity", "title": "Familiarity by investment" },
              { "type": "horizontal_bar", "field": "inv_satisfaction", "title": "Satisfaction by investment" }
            ]
          },
          { "id": "cohesion", "title": "Social cohesion activities",
            "charts": [
              { "type": "donut", "field": "s3_c1", "title": "Familiar with cohesion activities" },
              { "type": "bar_pct", "field": "s3_c3", "title": "Why participated" }
            ]
          },
          { "id": "perceptions", "title": "Perceptions & attitudes",
            "charts": [
              { "type": "stacked_bar", "field": "s5_trust", "by": "district", "title": "Trust by district" },
              { "type": "heatmap", "field": "s5_benefits", "by": "gender", "title": "Who benefits more grid" }
            ]
          },
          { "id": "services", "title": "Service satisfaction & change",
            "charts": [
              { "type": "stacked_bar", "field": "s6_satisfaction", "by": "district", "title": "Satisfaction by service" }
            ]
          },
          { "id": "conflict", "title": "Conflict & climate shocks",
            "charts": [
              { "type": "donut", "field": "s7_conflict_freq", "title": "Conflict frequency" },
              { "type": "bar_pct", "field": "s7_climate_shocks", "title": "Climate shocks experienced" }
            ]
          }
        ],
        "disaggregations": {
          "geography": { "fields": ["region","district","community"],
                         "labels": ["Region","District","Community"] },
          "gender": { "field": "gender" },
          "soco_exposure": {
            "Heard of SOCO": { "field": "s3_a1", "eq": 1 },
            "Attended meeting": { "field": "s3_a4", "eq": 1 },
            "Participated in cohesion activity": { "field": "s3_c2", "eq": 1 }
          }
        }
      }'::jsonb,
      true
    );
  end if;
end$$;
