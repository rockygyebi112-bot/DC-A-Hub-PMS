-- DC&A Hub PMS — extend activity_log to include 'proof_commented'
--
-- Comments on proofs are now first-class events in the project activity
-- feed so admins and staff get notified (via the existing notifications
-- bell, which reads from activity_log) whenever someone comments on a
-- document. Without this, the action insert in addProofComment would
-- violate the CHECK constraint added in 0009.

alter table activity_log drop constraint if exists activity_log_action_check;
alter table activity_log add constraint activity_log_action_check check (
  action in (
    'created',
    'updated',
    'started',
    'marked_done',
    'proof_added',
    'proof_deleted',
    'proof_commented'
  )
);

-- Allow client viewers (and any project participant) to record a
-- 'proof_commented' audit row when they post a comment. The existing
-- activity_log_write policy from 0011 only allows project writers
-- (admin / member), so a viewer's insert would otherwise be blocked by
-- RLS and the comment notification would never reach the admins.
--
-- We constrain this new policy tightly:
--   * action MUST be 'proof_commented' (no other audit types via this path)
--   * actor_user_id MUST equal auth.uid() (no impersonation)
--   * the caller must have read access to the project
drop policy if exists activity_log_comment_insert on activity_log;
create policy activity_log_comment_insert on activity_log for insert
  with check (
    action = 'proof_commented'
    and actor_user_id = auth.uid()
    and public.can_access_project(project_id)
  );
