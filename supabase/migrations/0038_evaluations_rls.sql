-- 0038_evaluations_rls.sql
--
-- Row-level security for all evaluation_* and mis_investments tables.
--
-- Read model:
--   admin                 — full read on every table.
--   staff (manager/member)— read everything for projects they belong to via
--                           project_members; QC + dashboard access.
--   client (viewer)       — read evaluations + instruments + dashboard_configs
--                           for their project; read responses ONLY where
--                           qc_status='approved'; NO read on mis_investments,
--                           response_investments, ingestion tables.
--
-- Write model:
--   admin                 — full write on every table.
--   staff (manager/member)— update qc_status on responses for their project;
--                           insert into ingestion_runs/issues only via the
--                           ingestion API (which uses SERVICE_ROLE, bypassing RLS).
--   client                — no writes anywhere.

alter table evaluations enable row level security;
alter table evaluation_instruments enable row level security;
alter table evaluation_dashboard_configs enable row level security;
alter table mis_investments enable row level security;
alter table evaluation_responses enable row level security;
alter table evaluation_response_investments enable row level security;
alter table evaluation_ingestion_runs enable row level security;
alter table evaluation_ingestion_issues enable row level security;

-- evaluations: anyone with project access reads.
create policy evaluations_read on evaluations for select
  using (public.can_access_project(project_id));
create policy evaluations_admin_write on evaluations for all
  using (public.is_admin()) with check (public.is_admin());

-- evaluation_instruments: scoped via parent evaluation. kobo_api_token_encrypted
-- is selectable; clients shouldn't be querying it directly, but defense in
-- depth happens in the queries layer where we never SELECT that column for
-- non-admin callers. Admins write.
create policy evaluation_instruments_read on evaluation_instruments for select
  using (
    exists (
      select 1 from evaluations e
      where e.id = evaluation_instruments.evaluation_id
        and public.can_access_project(e.project_id)
    )
  );
create policy evaluation_instruments_admin_write on evaluation_instruments for all
  using (public.is_admin()) with check (public.is_admin());

-- evaluation_dashboard_configs: read same as evaluations; admin writes.
create policy evaluation_dashboard_configs_read on evaluation_dashboard_configs for select
  using (
    exists (
      select 1 from evaluations e
      where e.id = evaluation_dashboard_configs.evaluation_id
        and public.can_access_project(e.project_id)
    )
  );
create policy evaluation_dashboard_configs_admin_write on evaluation_dashboard_configs for all
  using (public.is_admin()) with check (public.is_admin());

-- mis_investments: admin + staff (managers/members on the project) only.
create policy mis_investments_staff_read on mis_investments for select
  using (
    public.is_admin() or exists (
      select 1
      from evaluations e
      join project_members pm on pm.project_id = e.project_id
      where e.id = mis_investments.evaluation_id
        and pm.user_id = auth.uid()
        and pm.project_role in ('manager', 'member')
    )
  );
create policy mis_investments_admin_write on mis_investments for all
  using (public.is_admin()) with check (public.is_admin());

-- evaluation_responses: client sees only approved; staff/admin see all.
create policy evaluation_responses_read on evaluation_responses for select
  using (
    exists (
      select 1
      from evaluation_instruments i
      join evaluations e on e.id = i.evaluation_id
      where i.id = evaluation_responses.instrument_id
        and public.can_access_project(e.project_id)
        and (
          public.is_admin()
          or exists (
            select 1 from project_members pm
            where pm.project_id = e.project_id
              and pm.user_id = auth.uid()
              and pm.project_role in ('manager','member')
          )
          or evaluation_responses.qc_status = 'approved'
        )
    )
  );

-- Staff updates qc_status (and only qc_status fields) on responses they can see.
create policy evaluation_responses_staff_update on evaluation_responses for update
  using (
    exists (
      select 1
      from evaluation_instruments i
      join evaluations e on e.id = i.evaluation_id
      join project_members pm on pm.project_id = e.project_id
      where i.id = evaluation_responses.instrument_id
        and pm.user_id = auth.uid()
        and pm.project_role in ('manager','member')
    ) or public.is_admin()
  )
  with check (
    exists (
      select 1
      from evaluation_instruments i
      join evaluations e on e.id = i.evaluation_id
      join project_members pm on pm.project_id = e.project_id
      where i.id = evaluation_responses.instrument_id
        and pm.user_id = auth.uid()
        and pm.project_role in ('manager','member')
    ) or public.is_admin()
  );

create policy evaluation_responses_admin_write on evaluation_responses for all
  using (public.is_admin()) with check (public.is_admin());

-- evaluation_response_investments: staff + admin only.
create policy evaluation_response_investments_staff_read on evaluation_response_investments for select
  using (
    public.is_admin() or exists (
      select 1
      from evaluation_responses r
      join evaluation_instruments i on i.id = r.instrument_id
      join evaluations e on e.id = i.evaluation_id
      join project_members pm on pm.project_id = e.project_id
      where r.id = evaluation_response_investments.response_id
        and pm.user_id = auth.uid()
        and pm.project_role in ('manager','member')
    )
  );
create policy evaluation_response_investments_admin_write on evaluation_response_investments for all
  using (public.is_admin()) with check (public.is_admin());

-- Ingestion tables: admin-only by policy; pipeline writes via SERVICE_ROLE.
create policy evaluation_ingestion_runs_admin_read on evaluation_ingestion_runs for select
  using (public.is_admin());
create policy evaluation_ingestion_runs_admin_write on evaluation_ingestion_runs for all
  using (public.is_admin()) with check (public.is_admin());

create policy evaluation_ingestion_issues_admin_read on evaluation_ingestion_issues for select
  using (public.is_admin());
create policy evaluation_ingestion_issues_admin_write on evaluation_ingestion_issues for all
  using (public.is_admin()) with check (public.is_admin());
