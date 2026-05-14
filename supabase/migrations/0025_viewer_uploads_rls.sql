-- 0025_viewer_uploads_rls.sql
--
-- Addresses C-3: portal client (project_viewer) uploads currently bypass RLS
-- via the service-role client. Replace that with first-class viewer-insert
-- policies so the same code path runs through Postgres auth.
--
-- Rules:
--   * activity_proofs INSERT — admins/members unrestricted; viewers may only
--     insert rows whose `uploaded_by = auth.uid()`. Update/delete remain
--     locked to members (can_write_project).
--   * activity_log INSERT — admins/members unrestricted; viewers may only
--     insert rows attributed to themselves with a small allow-list of actions
--     ('updated', 'proof_added').
--   * storage.objects (proofs bucket) INSERT — extend to anyone who can
--     access the project. Update/delete stay restricted to members.

-- ---------------------------------------------------------------------------
-- activity_proofs: split the ALL policy into per-command policies.
-- ---------------------------------------------------------------------------
drop policy if exists activity_proofs_write on activity_proofs;

create policy activity_proofs_insert on activity_proofs
  for insert
  with check (
    -- Caller can reach this project at all.
    public.can_access_project(
      (select p.project_id from phases p
        join activities a on a.phase_id = p.id
        where a.id = activity_proofs.activity_id)
    )
    and (
      -- Members/admins have full write; viewers must own the row.
      public.can_write_project(
        (select p.project_id from phases p
          join activities a on a.phase_id = p.id
          where a.id = activity_proofs.activity_id)
      )
      or activity_proofs.uploaded_by = auth.uid()
    )
  );

create policy activity_proofs_update on activity_proofs
  for update
  using (
    public.can_write_project(
      (select p.project_id from phases p
        join activities a on a.phase_id = p.id
        where a.id = activity_proofs.activity_id)
    )
  )
  with check (
    public.can_write_project(
      (select p.project_id from phases p
        join activities a on a.phase_id = p.id
        where a.id = activity_proofs.activity_id)
    )
  );

create policy activity_proofs_delete on activity_proofs
  for delete
  using (
    public.can_write_project(
      (select p.project_id from phases p
        join activities a on a.phase_id = p.id
        where a.id = activity_proofs.activity_id)
    )
  );

-- ---------------------------------------------------------------------------
-- activity_log: expand the insert policy to permit viewer-attributed rows
-- for the small set of actions clients can take.
-- ---------------------------------------------------------------------------
drop policy if exists activity_log_write on activity_log;

create policy activity_log_write on activity_log
  for insert
  with check (
    -- Member/admin path (existing behaviour) — actor must be self.
    (
      public.can_write_project(project_id)
      and (actor_user_id is null or actor_user_id = auth.uid())
    )
    or
    -- Viewer path — only self-attributed, only allow-listed actions.
    (
      public.can_access_project(project_id)
      and actor_user_id = auth.uid()
      and action in ('updated', 'proof_added')
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: viewers can write into the proofs bucket scoped to their project.
-- Update/delete remain members-only via the existing proofs_update/delete
-- policies in 0003.
-- ---------------------------------------------------------------------------
drop policy if exists "proofs_write" on storage.objects;

create policy "proofs_write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'proofs'
    and public.can_access_project(public.project_id_from_path(name))
  );
