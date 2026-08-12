-- 0049_user_notifications.sql
--
-- Per-recipient notification inbox for events that have no project.
--
-- The notifications bell reads `activity_log`, whose project_id is NOT NULL and
-- FK'd to projects, under RLS `is_admin() OR can_access_project(project_id)`.
-- Internal tasks have no project and satisfy neither condition. Rather than
-- bend a project-scoped broadcast audit trail into a per-user inbox, this table
-- stores one already-rendered row per recipient.
--
-- Rows are written by the service-role client only (see notify* modules); there
-- is deliberately no insert policy for authenticated users.

create table user_notifications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  type             text not null check (type in ('internal_task_assigned')),
  title            text not null,          -- task title
  subtitle         text,                   -- section (area) name
  href             text,
  actor_name       text,                   -- denormalised: profiles RLS hides
                                           -- colleagues from a user-scoped read
  actor_user_id    uuid references auth.users(id) on delete set null,
  internal_task_id uuid references internal_tasks(id) on delete cascade,
  created_at       timestamptz not null default now()
);

create index user_notifications_user_idx
  on user_notifications(user_id, created_at desc);

alter table user_notifications enable row level security;

-- Read-only for the recipient. No insert policy (service-role writes only) and
-- no update policy: read state lives in user_notification_reads.last_read_at,
-- so there is nothing on a row for a user to mutate.
drop policy if exists user_notifications_self_select on user_notifications;
create policy user_notifications_self_select on user_notifications
  for select using (user_id = auth.uid());

-- Realtime so the bell can live-refresh. Guarded exactly like migration 0017.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'user_notifications'
    ) then
      alter publication supabase_realtime add table user_notifications;
    end if;
  end if;
end $$;

comment on table user_notifications is
  'Per-recipient rendered notifications for non-project events; service-role writes only.';
