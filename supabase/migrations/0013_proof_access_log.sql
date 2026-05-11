-- DC&A Hub PMS — proof_access_log
-- Audit trail for every time a user opens an activity_proof (file or link).
-- Combined with a confirm-before-open UI gate, this gives the admin a record
-- of who viewed which sensitive document and when.

create table proof_access_log (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references activity_proofs(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text,
  user_agent text,
  ip_address inet,
  accessed_at timestamptz not null default now()
);

create index proof_access_log_proof_id_idx on proof_access_log(proof_id);
create index proof_access_log_project_id_idx on proof_access_log(project_id);
create index proof_access_log_user_id_idx on proof_access_log(user_id);
create index proof_access_log_accessed_at_idx on proof_access_log(accessed_at desc);

-- RLS ----------------------------------------------------------------------
alter table proof_access_log enable row level security;

-- Admins can read all entries; project members can read entries scoped to
-- the projects they belong to (so a PM can audit team activity).
create policy proof_access_log_admin_read on proof_access_log for select
  using (public.is_admin());

create policy proof_access_log_member_read on proof_access_log for select
  using (public.can_access_project(project_id));

-- Users can only insert log rows for themselves and only for projects they
-- can access. Anything else is rejected by RLS.
create policy proof_access_log_self_insert on proof_access_log for insert
  with check (
    user_id = auth.uid()
    and public.can_access_project(project_id)
  );

-- Log rows are append-only — no update/delete policies are defined.

grant select, insert on proof_access_log to authenticated;
