-- 0034_internal_workspace_fix_recursion.sql
--
-- Fix infinite-recursion in internal workspace RLS policies introduced by
-- 0033. The policies on internal_task_assignees and internal_tasks each
-- referenced internal_task_assignees in their USING clauses, which retriggers
-- the assignees-table policy (whose own subquery again selects from
-- internal_task_assignees) and Postgres aborts with
-- "infinite recursion detected in policy for relation internal_task_assignees".
--
-- Fix: route the assignee lookup through a SECURITY DEFINER helper that
-- bypasses RLS, then rewrite the affected policies to call it.

create or replace function public.is_task_assignee(p_task_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from internal_task_assignees
     where task_id = p_task_id
       and user_id = p_user_id
  );
$$;

comment on function public.is_task_assignee(uuid, uuid) is
  'Bypass-RLS check for assignee membership; used by internal workspace policies to avoid self-referential recursion.';

-- internal_tasks read: admin OR caller is assignee on this task
drop policy if exists internal_tasks_read on internal_tasks;
create policy internal_tasks_read on internal_tasks for select
  using (
    public.is_admin()
    or public.is_task_assignee(id, auth.uid())
  );

-- internal_tasks assignee update: caller is assignee on this task
drop policy if exists internal_tasks_assignee_update on internal_tasks;
create policy internal_tasks_assignee_update on internal_tasks for update
  using (public.is_task_assignee(id, auth.uid()))
  with check (public.is_task_assignee(id, auth.uid()));

-- internal_task_assignees read: admin OR own row OR co-assignee on the task
drop policy if exists internal_task_assignees_read on internal_task_assignees;
create policy internal_task_assignees_read on internal_task_assignees for select
  using (
    public.is_admin()
    or user_id = auth.uid()
    or public.is_task_assignee(task_id, auth.uid())
  );

-- internal_task_assignees assignee insert: caller is already an assignee on the task
drop policy if exists internal_task_assignees_assignee_write on internal_task_assignees;
create policy internal_task_assignees_assignee_write on internal_task_assignees for insert
  with check (public.is_task_assignee(task_id, auth.uid()));
