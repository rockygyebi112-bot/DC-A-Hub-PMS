-- 0009 Workplan responsible + proof links
-- - Add a responsible field to activities so the team member/team responsible
--   for an activity is a first-class column (rather than baked into description).
-- - Allow activity_proofs to be either uploaded files OR external links/URLs.
-- - Allow the new 'started' action in activity_log.

-- activities.responsible ----------------------------------------------------
alter table activities add column if not exists responsible text;

-- activity_proofs: files OR links -------------------------------------------
alter table activity_proofs add column if not exists kind text not null default 'file';
alter table activity_proofs add column if not exists url text;
alter table activity_proofs alter column file_path drop not null;

alter table activity_proofs drop constraint if exists activity_proofs_kind_check;
alter table activity_proofs add constraint activity_proofs_kind_check
  check (kind in ('file', 'link'));

alter table activity_proofs drop constraint if exists activity_proofs_payload_check;
alter table activity_proofs add constraint activity_proofs_payload_check check (
  (kind = 'file' and file_path is not null) or
  (kind = 'link' and url is not null)
);

-- activity_log: include 'started' -------------------------------------------
alter table activity_log drop constraint if exists activity_log_action_check;
alter table activity_log add constraint activity_log_action_check check (
  action in (
    'created',
    'updated',
    'started',
    'marked_done',
    'proof_added',
    'proof_deleted'
  )
);
