-- DC&A Hub PMS — proof comments
--
-- Lets any project participant (admin, member, or client viewer) leave a
-- short comment on an uploaded proof / attachment. Comments are visible to
-- everyone with project access, so a client can flag a concern on a
-- specific document and the project team sees it without needing a
-- separate email/chat thread.

create table if not exists proof_comments (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references activity_proofs(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0 and length(body) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proof_comments_proof_id_idx
  on proof_comments(proof_id, created_at);
create index if not exists proof_comments_author_idx
  on proof_comments(author_user_id);

-- Keep updated_at fresh on edits. Reuses the trigger function defined in
-- 0001_init_schema.sql.
drop trigger if exists proof_comments_set_updated_at on proof_comments;
create trigger proof_comments_set_updated_at
  before update on proof_comments
  for each row execute function set_updated_at();

alter table proof_comments enable row level security;

-- Read: anyone with project access (admin, member, viewer).
drop policy if exists proof_comments_read on proof_comments;
create policy proof_comments_read on proof_comments for select
  using (
    public.can_access_project(
      (
        select ph.project_id
        from phases ph
        join activities a on a.phase_id = ph.id
        join activity_proofs pr on pr.activity_id = a.id
        where pr.id = proof_comments.proof_id
      )
    )
  );

-- Insert: anyone with project access; authoring as self.
drop policy if exists proof_comments_insert on proof_comments;
create policy proof_comments_insert on proof_comments for insert
  with check (
    author_user_id = auth.uid()
    and public.can_access_project(
      (
        select ph.project_id
        from phases ph
        join activities a on a.phase_id = ph.id
        join activity_proofs pr on pr.activity_id = a.id
        where pr.id = proof_comments.proof_id
      )
    )
  );

-- Update: only the author can edit their own comment.
drop policy if exists proof_comments_update on proof_comments;
create policy proof_comments_update on proof_comments for update
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid());

-- Delete: author or admin.
drop policy if exists proof_comments_delete on proof_comments;
create policy proof_comments_delete on proof_comments for delete
  using (author_user_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on proof_comments to authenticated;
