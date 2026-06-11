-- 0048_internal_subtasks.sql
--
-- Subtasks: a task may have child tasks (Asana-style). A subtask is just an
-- internal_tasks row with parent_task_id set; it inherits the parent's section
-- (area_id). Deleting a parent cascades to its subtasks.
--
-- Top-level lists/boards filter to parent_task_id IS NULL so subtasks only show
-- on the parent's detail page.

alter table internal_tasks
  add column if not exists parent_task_id uuid
    references internal_tasks(id) on delete cascade;

create index if not exists internal_tasks_parent_idx
  on internal_tasks (parent_task_id)
  where parent_task_id is not null;
