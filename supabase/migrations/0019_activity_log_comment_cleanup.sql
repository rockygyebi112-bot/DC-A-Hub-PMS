-- DC&A Hub PMS — let comment authors clean up their own notification rows
--
-- When a comment is edited (to fix a mistagged user) or deleted entirely,
-- the matching rows in activity_log need to go with it. Today RLS has no
-- delete policy on activity_log, which means every edit/delete leaves
-- orphan "proof_commented" / "proof_mentioned" bell entries pointing at
-- a comment_id that no longer exists.
--
-- The simplest, safe scope is: the user who recorded the row (the comment
-- author) can delete it, and admins can delete anything. The rows
-- themselves carry the comment_id in meta, so the server-side action can
-- scope the delete with `meta @> '{"comment_id": "..."}'::jsonb`.

drop policy if exists activity_log_author_delete on activity_log;
create policy activity_log_author_delete on activity_log for delete
  using (
    public.is_admin()
    or (
      actor_user_id = auth.uid()
      and action in ('proof_commented', 'proof_mentioned')
    )
  );

-- Speeds up the "find all activity_log rows for this comment" lookup we
-- now do on every edit and delete. Partial index keeps it tiny.
create index if not exists activity_log_comment_id_idx
  on activity_log ((meta->>'comment_id'))
  where action in ('proof_commented', 'proof_mentioned');
