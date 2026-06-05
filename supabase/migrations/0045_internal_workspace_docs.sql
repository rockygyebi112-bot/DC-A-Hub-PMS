-- 0045_internal_workspace_docs.sql
--
-- Internal Workspace: documents + comments (the part 0033 deliberately
-- deferred — see its "v1 omits proofs/comments" note).
--
-- Mirrors the project-side pattern (activity_proofs + proof_comments) but
-- scoped to internal tasks, which have no client/project access model. Any
-- staff member or admin can upload, view, and comment; authors (and admins)
-- can delete their own rows. The internal task page itself is still gated by
-- the internal_tasks_read policy (admin or assignee), so this keeps the new
-- tables consistent with internal_areas_read (is_staff_or_admin()).
--
-- Tables:
--   internal_task_proofs          — uploaded documents
--   internal_task_comments        — task-level discussion feed
--   internal_task_proof_comments  — per-document comment threads

-- internal_task_proofs -------------------------------------------------
create table internal_task_proofs (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references internal_tasks(id) on delete cascade,
  file_path    text not null,
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint,
  caption      text,
  uploaded_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index internal_task_proofs_task_idx on internal_task_proofs(task_id, created_at);

-- internal_task_comments (task-level feed) -----------------------------
create table internal_task_comments (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references internal_tasks(id) on delete cascade,
  author_user_id  uuid not null references auth.users(id) on delete cascade,
  body            text not null check (length(trim(body)) > 0 and length(body) <= 4000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index internal_task_comments_task_idx on internal_task_comments(task_id, created_at);

-- internal_task_proof_comments (per-document threads) ------------------
create table internal_task_proof_comments (
  id              uuid primary key default gen_random_uuid(),
  proof_id        uuid not null references internal_task_proofs(id) on delete cascade,
  author_user_id  uuid not null references auth.users(id) on delete cascade,
  body            text not null check (length(trim(body)) > 0 and length(body) <= 4000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index internal_task_proof_comments_proof_idx
  on internal_task_proof_comments(proof_id, created_at);

-- updated_at triggers (reuse set_updated_at from 0001) -----------------
create trigger internal_task_comments_updated_at before update on internal_task_comments
  for each row execute function set_updated_at();
create trigger internal_task_proof_comments_updated_at before update on internal_task_proof_comments
  for each row execute function set_updated_at();

-- RLS ------------------------------------------------------------------
alter table internal_task_proofs          enable row level security;
alter table internal_task_comments        enable row level security;
alter table internal_task_proof_comments  enable row level security;

-- internal_task_proofs: any staff/admin reads; author uploads; author or
-- admin deletes. (No update path — captions are set at upload time.)
create policy internal_task_proofs_read on internal_task_proofs for select
  using (public.is_staff_or_admin());
create policy internal_task_proofs_insert on internal_task_proofs for insert
  with check (public.is_staff_or_admin() and uploaded_by = auth.uid());
create policy internal_task_proofs_delete on internal_task_proofs for delete
  using (uploaded_by = auth.uid() or public.is_admin());

-- internal_task_comments
create policy internal_task_comments_read on internal_task_comments for select
  using (public.is_staff_or_admin());
create policy internal_task_comments_insert on internal_task_comments for insert
  with check (public.is_staff_or_admin() and author_user_id = auth.uid());
create policy internal_task_comments_update on internal_task_comments for update
  using (author_user_id = auth.uid()) with check (author_user_id = auth.uid());
create policy internal_task_comments_delete on internal_task_comments for delete
  using (author_user_id = auth.uid() or public.is_admin());

-- internal_task_proof_comments
create policy internal_task_proof_comments_read on internal_task_proof_comments for select
  using (public.is_staff_or_admin());
create policy internal_task_proof_comments_insert on internal_task_proof_comments for insert
  with check (public.is_staff_or_admin() and author_user_id = auth.uid());
create policy internal_task_proof_comments_update on internal_task_proof_comments for update
  using (author_user_id = auth.uid()) with check (author_user_id = auth.uid());
create policy internal_task_proof_comments_delete on internal_task_proof_comments for delete
  using (author_user_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on internal_task_proofs         to authenticated;
grant select, insert, update, delete on internal_task_comments       to authenticated;
grant select, insert, update, delete on internal_task_proof_comments to authenticated;

-- Storage: reuse the existing private `proofs` bucket under an
-- `internal/tasks/{taskId}/...` prefix. The 0003 policies key off
-- project_id_from_path(), which returns NULL for non-project paths, so they
-- never match internal objects — these dedicated policies cover them and are
-- OR'd in (RLS policies are permissive).
create policy "proofs_internal_read" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and name like 'internal/tasks/%' and public.is_staff_or_admin());
create policy "proofs_internal_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and name like 'internal/tasks/%' and public.is_staff_or_admin());
create policy "proofs_internal_update" on storage.objects for update to authenticated
  using (bucket_id = 'proofs' and name like 'internal/tasks/%' and public.is_staff_or_admin());
create policy "proofs_internal_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and name like 'internal/tasks/%' and public.is_staff_or_admin());

comment on table internal_task_proofs is
  'Documents attached to DC&A Hub internal tasks; staff/admin only.';
comment on table internal_task_comments is
  'Task-level discussion feed on internal tasks.';
comment on table internal_task_proof_comments is
  'Per-document comment threads on internal task uploads.';
