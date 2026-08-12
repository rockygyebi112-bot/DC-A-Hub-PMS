-- 0050_internal_task_mentions.sql
--
-- Allow the @mention notification type on the per-recipient inbox added in
-- 0049. That table was written with a deliberately narrow CHECK
-- (`type in ('internal_task_assigned')`) and its header comment anticipated
-- this exact follow-up: "a home for future non-project notifications
-- (internal-task comment mentions, due-date reminders)".
--
-- Nothing else changes. No new columns: a mention notification carries the
-- same shape as an assignment (task title, section name, href, actor). No RLS
-- change: `user_notifications_self_select` already scopes reads to the
-- recipient, and the table still has no insert policy for authenticated users
-- because the writer uses the service-role client.

alter table user_notifications
  drop constraint if exists user_notifications_type_check;

alter table user_notifications
  add constraint user_notifications_type_check
  check (type in ('internal_task_assigned', 'internal_task_mentioned'));
