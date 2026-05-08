-- 0008 Notifications: allow project viewers (clients) to read activity_log
-- for their projects, and add a per-user read cursor.

-- Replace member-only read policy with one that any project member can read.
drop policy if exists activity_log_member_read on activity_log;

create policy activity_log_member_read on activity_log for select
  using (
    public.is_admin() or public.can_access_project(activity_log.project_id)
  );

-- Per-user read cursor for notifications (last_read_at timestamp).
create table if not exists user_notification_reads (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_notification_reads enable row level security;

drop policy if exists user_notification_reads_self_select on user_notification_reads;
drop policy if exists user_notification_reads_self_insert on user_notification_reads;
drop policy if exists user_notification_reads_self_update on user_notification_reads;

create policy user_notification_reads_self_select on user_notification_reads
  for select using (user_id = auth.uid());

create policy user_notification_reads_self_insert on user_notification_reads
  for insert with check (user_id = auth.uid());

create policy user_notification_reads_self_update on user_notification_reads
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger user_notification_reads_updated_at before update on user_notification_reads
  for each row execute function set_updated_at();
