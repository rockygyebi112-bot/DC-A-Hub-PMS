-- DC&A Hub PMS — collaboration upgrades for proof comments
--
-- Three things ship together because they're all about the comment thread
-- working like a real conversation:
--
--   1. Project participants can see each other's profile (full_name +
--      avatar_url + email) so the comment list shows real names instead of
--      a generic "Member" placeholder.
--   2. proof_comments is added to the realtime publication so new
--      comments stream in without a manual refresh.
--   3. activity_log gets an optional target_user_id column so we can
--      record per-user @mention notifications and filter the bell feed
--      to the recipient.

-- ---------------------------------------------------------------------------
-- 1. Profiles visibility for project participants
-- ---------------------------------------------------------------------------
-- A user "shares a project" with another user when they're both members
-- (or viewers) on the same project. Admins always pass.
create or replace function public.shares_project_with(target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    target_user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from project_members me
      join project_members them on them.project_id = me.project_id
      where me.user_id = auth.uid()
        and them.user_id = target_user_id
    );
$$;

drop policy if exists profiles_self_read on profiles;
-- New read policy: yourself, admin, or anyone you share a project with.
-- Without this, listProofComments couldn't resolve other users' names and
-- the comment thread would render every author as "Member".
create policy profiles_self_read on profiles for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.shares_project_with(user_id)
  );

-- ---------------------------------------------------------------------------
-- 2. Realtime publication for proof_comments
-- ---------------------------------------------------------------------------
-- supabase_realtime is the default publication Supabase listens on.
-- Adding the table here lets clients subscribe to inserts/updates/deletes
-- so comments appear instantly for everyone watching the proof.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Only add the table if it isn't already in the publication, so this
    -- migration is safely re-runnable.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'proof_comments'
    ) then
      alter publication supabase_realtime add table proof_comments;
    end if;
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- 3. Per-user notification target on activity_log
-- ---------------------------------------------------------------------------
-- target_user_id = NULL means "broadcast to everyone with project access"
-- (the existing behaviour). When set, the notifications feed filters to
-- only show the row to that user — used by @mention notifications.
alter table activity_log
  add column if not exists target_user_id uuid
    references auth.users(id) on delete cascade;

create index if not exists activity_log_target_user_idx
  on activity_log(target_user_id)
  where target_user_id is not null;

-- Allow the new 'proof_mentioned' action and let any project participant
-- record one for themselves (the comment author records the mentions).
alter table activity_log drop constraint if exists activity_log_action_check;
alter table activity_log add constraint activity_log_action_check check (
  action in (
    'created',
    'updated',
    'started',
    'marked_done',
    'proof_added',
    'proof_deleted',
    'proof_commented',
    'proof_mentioned'
  )
);

drop policy if exists activity_log_mention_insert on activity_log;
create policy activity_log_mention_insert on activity_log for insert
  with check (
    action = 'proof_mentioned'
    and actor_user_id = auth.uid()
    and target_user_id is not null
    and public.can_access_project(project_id)
  );

-- The existing read policy is OR'd with: only the targeted user (and
-- admins) should see a targeted row in their feed. Broadcast rows
-- (target_user_id IS NULL) keep the old behaviour.
drop policy if exists activity_log_member_read on activity_log;
create policy activity_log_member_read on activity_log for select
  using (
    public.is_admin()
    or (
      public.can_access_project(activity_log.project_id)
      and (
        activity_log.target_user_id is null
        or activity_log.target_user_id = auth.uid()
      )
    )
  );
